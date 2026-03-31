import { Router } from 'express';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, createReadStream } from 'node:fs';
import path from 'node:path';
import { createHttpError, logInfo, logWarn, logError } from '../logger.js';

const execAsync = promisify(exec);
const BATCH_SIZE = 1000;

export function createMaintenanceRoutes(deps = {}) {
  const {
    query = async () => [],
    one = async () => null,
    sessionSecret = process.env.SESSION_SECRET,
  } = deps;

  const router = Router();

  function requireAdmin(req, res, next) {
    if (!req.session?.adminUser) {
      throw createHttpError(401, 'Authentication required');
    }
    next();
  }

  function getBackupDir() {
    const backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'storage', 'backups');
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }
    return backupDir;
  }

  function getBackupAgeHours(filename) {
    const match = filename.match(/^backup-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
    if (!match) return Infinity;
    const backupTime = new Date(match[1].replace('T', ' '));
    return (Date.now() - backupTime.getTime()) / (1000 * 60 * 60);
  }

  function getMaxBackups() {
    return Number(process.env.MAX_BACKUPS || 5);
  }

  function getRateLimitHours() {
    return Number(process.env.BACKUP_RATE_LIMIT_HOURS || 1);
  }

  function cleanupOldBackups(backupDir) {
    const files = readdirSync(backupDir)
      .filter((f) => f.endsWith('.sql.gz'))
      .sort((a, b) => {
        const timeA = new Date(a.match(/^backup-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/)?.[1]?.replace('T', ' ') || '1970-01-01 00:00:00').getTime();
        const timeB = new Date(b.match(/^backup-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/)?.[1]?.replace('T', ' ') || '1970-01-01 00:00:00').getTime();
        return timeA - timeB;
      });

    while (files.length > getMaxBackups()) {
      const oldest = files.shift();
      unlinkSync(path.join(backupDir, oldest));
    }
  }

  router.use(requireAdmin);

  router.get('/backup', async (req, res) => {
    const backupDir = getBackupDir();

    const files = readdirSync(backupDir)
      .filter((f) => f.endsWith('.sql.gz'))
      .map((f) => {
        const stats = statSync(path.join(backupDir, f));
        return {
          filename: f,
          size: stats.size,
          createdAt: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.json({ data: { backups: files } });
  });

  router.post('/backup', async (req, res) => {
    const backupDir = getBackupDir();
    const rateLimitHours = getRateLimitHours();

    const files = readdirSync(backupDir).filter((f) => f.endsWith('.sql.gz'));
    const recentBackups = files.filter((f) => getBackupAgeHours(f) < rateLimitHours);

    if (recentBackups.length > 0) {
      throw createHttpError(
        429,
        `Backup rate limit exceeded. Please wait ${rateLimitHours} hour(s) between backups.`
      );
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.sql.gz`;
    const filepath = path.join(backupDir, filename);

    const dbHost = process.env.MYSQL_HOST || 'localhost';
    const dbPort = process.env.MYSQL_PORT || 3306;
    const dbUser = process.env.MYSQL_USER;
    const dbPass = process.env.MYSQL_PASSWORD;
    const dbName = process.env.MYSQL_DATABASE;

    const mysqldumpCmd = `mysqldump --host=${dbHost} --port=${dbPort} --user=${dbUser} --password="${dbPass}" --single-transaction --quick --lock-tables=false --routines --triggers ${dbName} 2>/dev/null | gzip > "${filepath}"`;

    try {
      await execAsync(mysqldumpCmd);

      cleanupOldBackups(backupDir);

      const stats = statSync(filepath);
      logInfo('backup_created', { filename, size: stats.size });

      res.json({
        data: {
          filename,
          size: stats.size,
          message: 'Backup created successfully',
        },
      });
    } catch (error) {
      logError('backup_failed', error);
      if (existsSync(filepath)) {
        unlinkSync(filepath);
      }
      throw createHttpError(500, 'Backup creation failed');
    }
  });

  router.get('/backup/:filename', async (req, res) => {
    const { filename } = req.params;
    const backupDir = getBackupDir();
    const filepath = path.join(backupDir, filename);

    if (!filename.endsWith('.sql.gz') || !existsSync(filepath)) {
      throw createHttpError(404, 'Backup not found');
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', statSync(filepath).size);
    createReadStream(filepath).pipe(res);
  });

  router.delete('/backup/:filename', async (req, res) => {
    const { filename } = req.params;
    const backupDir = getBackupDir();
    const filepath = path.join(backupDir, filename);

    if (!filename.endsWith('.sql.gz') || !existsSync(filepath)) {
      throw createHttpError(404, 'Backup not found');
    }

    unlinkSync(filepath);
    logInfo('backup_deleted', { filename });
    res.json({ data: { message: 'Backup deleted' } });
  });

  router.post('/backup/restore', async (req, res) => {
    const { filename } = req.body;
    const backupDir = getBackupDir();
    const filepath = path.join(backupDir, filename);

    if (!filename || !filename.endsWith('.sql.gz') || !existsSync(filepath)) {
      throw createHttpError(400, 'Invalid or missing backup filename');
    }

    const dbHost = process.env.MYSQL_HOST || 'localhost';
    const dbPort = process.env.MYSQL_PORT || 3306;
    const dbUser = process.env.MYSQL_USER;
    const dbPass = process.env.MYSQL_PASSWORD;
    const dbName = process.env.MYSQL_DATABASE;

    const mysqlCmd = `gunzip < "${filepath}" | mysql --host=${dbHost} --port=${dbPort} --user=${dbUser} --password="${dbPass}" ${dbName}`;

    try {
      await execAsync(mysqlCmd);
      logInfo('backup_restored', { filename });
      res.json({ data: { message: 'Restore completed successfully' } });
    } catch (error) {
      logError('restore_failed', error);
      throw createHttpError(500, `Restore failed: ${error.message}`);
    }
  });

  router.post('/cleanup', async (req, res) => {
    const retentionDays = Number(req.body.retentionDays || process.env.DATA_RETENTION_DAYS || 90);

    if (retentionDays < 1 || retentionDays > 365) {
      throw createHttpError(400, 'Retention days must be between 1 and 365');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffStr = cutoffDate.toISOString().slice(0, 19).replace('T', ' ');

    const stats = {
      sessions: 0,
      events: 0,
      linkClicks: 0,
    };

    try {
      let [result] = await query(
        `DELETE FROM visitor_sessions WHERE started_at < ? LIMIT ?`,
        [cutoffStr, BATCH_SIZE]
      );
      stats.sessions = result.affectedRows;

      [result] = await query(
        `DELETE FROM analytics_events WHERE session_id NOT IN (SELECT id FROM visitor_sessions) LIMIT ?`,
        [BATCH_SIZE]
      );
      stats.events = result.affectedRows;

      [result] = await query(
        `DELETE FROM link_clicks WHERE clicked_at < ? LIMIT ?`,
        [cutoffStr, BATCH_SIZE]
      );
      stats.linkClicks = result.affectedRows;

      logInfo('data_cleanup_completed', { retentionDays, stats });
      res.json({
        data: {
          message: `Cleanup completed. Removed ${stats.sessions} sessions, ${stats.events} events, ${stats.linkClicks} clicks older than ${retentionDays} days.`,
          stats,
        },
      });
    } catch (error) {
      logError('cleanup_failed', error);
      throw createHttpError(500, `Cleanup failed: ${error.message}`);
    }
  });

  router.get('/db-health', async (req, res) => {
    try {
      const [tablesResult] = await query(`
        SELECT TABLE_NAME, TABLE_ROWS 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE()
      `);

      const [sizeResult] = await query(`
        SELECT SUM(data_length + index_length) AS size_bytes 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE()
      `);

      const tables = {};
      for (const row of tablesResult) {
        tables[row.TABLE_NAME] = row.TABLE_ROWS;
      }

      const sizeBytes = sizeResult[0]?.size_bytes || 0;
      const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);

      res.json({
        data: {
          status: 'healthy',
          tables,
          sizeMB,
          checkedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logError('db_health_check_failed', error);
      res.json({
        data: {
          status: 'error',
          error: error.message,
          checkedAt: new Date().toISOString(),
        },
      });
    }
  });

  return router;
}

export default createMaintenanceRoutes;
