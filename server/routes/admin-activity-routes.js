import { Router } from 'express';
import { createHttpError } from '../logger.js';

export function createAdminActivityRoutes(deps = {}) {
  const { query = async () => [] } = deps;

  const router = Router();

  router.get('/activity-log', async (req, res) => {
    if (!req.session?.adminUser) {
      throw createHttpError(401, 'Authentication required');
    }

    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Number(req.query.offset) || 0;
    const action = req.query.action || null;
    const adminId = req.query.adminId || null;

    let sql = `
      SELECT id, admin_id, admin_email, action, resource_type, resource_id, details, ip_address, created_at
      FROM activity_log
    `;
    const params = [];
    const conditions = [];

    if (action) {
      conditions.push('action = ?');
      params.push(action);
    }

    if (adminId) {
      conditions.push('admin_id = ?');
      params.push(adminId);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await query(sql, params);

    const countSql = action || adminId
      ? 'SELECT COUNT(*) as total FROM activity_log WHERE ' + (action ? 'action = ?' : '1=1') + (adminId ? ' AND admin_id = ?' : '')
      : 'SELECT COUNT(*) as total FROM activity_log';

    const countParams = [];
    if (action) countParams.push(action);
    if (adminId) countParams.push(adminId);

    const [countRow] = await query(countSql, countParams);
    const total = countRow?.total || 0;

    res.json({
      data: {
        activities: rows.map((row) => ({
          id: row.id,
          adminId: row.admin_id,
          adminEmail: row.admin_email,
          action: row.action,
          resourceType: row.resource_type,
          resourceId: row.resource_id,
          details: row.details ? JSON.parse(row.details) : null,
          ipAddress: row.ip_address,
          createdAt: row.created_at,
        })),
        total,
        limit,
        offset,
      },
    });
  });

  return router;
}

export default createAdminActivityRoutes;