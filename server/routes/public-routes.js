import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
  assertResourceTable,
  asyncHandler,
  normalizeLink,
  normalizeModule,
  normalizeTestimonial,
  optionalText,
  requiredEmail,
  requiredText,
} from './shared.js';

export function createPublicRoutes(deps) {
  const router = Router();

  router.get(
    '/site-settings',
    asyncHandler(async (_request, response) => {
      const row = await deps.one('SELECT * FROM site_settings WHERE id = 1 LIMIT 1');
      response.json({ data: row });
    })
  );

  router.get(
    '/modules',
    asyncHandler(async (_request, response) => {
      const rows = await deps.query('SELECT * FROM modules ORDER BY display_order ASC');
      response.json({ data: rows.map(normalizeModule) });
    })
  );

  router.get(
    '/links/active',
    asyncHandler(async (_request, response) => {
      const rows = await deps.query(
        'SELECT * FROM links WHERE is_active = 1 ORDER BY display_order ASC, created_at ASC'
      );
      response.json({ data: rows.map(normalizeLink) });
    })
  );

  router.get(
    '/resources/:table',
    asyncHandler(async (request, response) => {
      const table = assertResourceTable(request.params.table);
      const rows = await deps.query(`SELECT * FROM ${table} ORDER BY display_order ASC, created_at ASC`);
      response.json({ data: rows });
    })
  );

  router.post(
    '/bookings',
    asyncHandler(async (request, response) => {
      const name = requiredText(request.body?.name, 'Name', 255);
      const email = requiredEmail(request.body?.email, deps.normalizeEmail);
      const topic = requiredText(request.body?.topic, 'Topic', 255);
      const schedule = requiredText(request.body?.schedule, 'Schedule');

      await deps.query(
        'INSERT INTO bookings (id, name, email, topic, schedule, status) VALUES (?, ?, ?, ?, ?, ?)',
        [randomUUID(), name, email, topic, schedule, 'pending']
      );

      response.status(201).json({ data: { success: true } });
    })
  );

  router.get(
    '/testimonials/featured',
    asyncHandler(async (_request, response) => {
      const rows = await deps.query(
        'SELECT * FROM testimonials WHERE is_featured = 1 ORDER BY display_order ASC, created_at ASC'
      );
      response.json({ data: rows.map(normalizeTestimonial) });
    })
  );

  router.post(
    '/contact-messages',
    asyncHandler(async (request, response) => {
      const name = requiredText(request.body?.name, 'Name', 255);
      const email = requiredEmail(request.body?.email, deps.normalizeEmail);
      const message = requiredText(request.body?.message, 'Message', 2000);

      await deps.query(
        'INSERT INTO contact_messages (id, name, email, message, is_read) VALUES (?, ?, ?, ?, ?)',
        [randomUUID(), name, email, message, 0]
      );

      response.status(201).json({ data: { success: true } });
    })
  );

  router.post(
    '/link-clicks',
    asyncHandler(async (request, response) => {
      const linkId = optionalText(request.body?.linkId, 36);
      const linkTitle = optionalText(request.body?.linkTitle, 255);

      await deps.query(
        'INSERT INTO link_clicks (id, link_id, link_title) VALUES (?, ?, ?)',
        [randomUUID(), linkId, linkTitle]
      );

      response.status(201).json({ data: { success: true } });
    })
  );

  return router;
}
