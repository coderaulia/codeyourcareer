import 'dotenv/config';
import mysql from 'mysql2/promise';

const RETENTION_DAYS = Number(process.env.DATA_RETENTION_DAYS || 90);
const BATCH_SIZE = 1000;

async function cleanup() {
  console.log(`Starting data cleanup for data older than ${RETENTION_DAYS} days...`);

  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    database: process.env.MYSQL_DATABASE,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    waitForConnections: true,
    connectionLimit: 5,
    timezone: 'Z',
  });

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  const cutoffStr = cutoffDate.toISOString().slice(0, 19).replace('T', ' ');

  const stats = {
    sessions: 0,
    events: 0,
    linkClicks: 0,
  };

  try {
    const connection = await pool.getConnection();

    try {
      let [result] = await connection.execute(
        `DELETE FROM visitor_sessions WHERE started_at < ? LIMIT ?`,
        [cutoffStr, BATCH_SIZE]
      );
      stats.sessions = result.affectedRows;
      console.log(`  Deleted ${stats.sessions} visitor sessions`);

      [result] = await connection.execute(
        `DELETE FROM analytics_events WHERE session_id NOT IN (SELECT id FROM visitor_sessions) LIMIT ?`,
        [BATCH_SIZE]
      );
      stats.events = result.affectedRows;
      console.log(`  Deleted ${stats.events} orphaned analytics events`);

      [result] = await connection.execute(
        `DELETE FROM link_clicks WHERE clicked_at < ? LIMIT ?`,
        [cutoffStr, BATCH_SIZE]
      );
      stats.linkClicks = result.affectedRows;
      console.log(`  Deleted ${stats.linkClicks} link clicks`);

      console.log('\nCleanup complete:', stats);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Cleanup error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }

  return stats;
}

cleanup()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
