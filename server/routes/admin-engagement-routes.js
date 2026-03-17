import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
  BOOKING_STATUSES,
  asyncHandler,
  ensureUniqueTestimonial,
  getExistingDisplayOrder,
  getNextDisplayOrder,
  integerValue,
  normalizeMessage,
  normalizeTestimonial,
  optionalInteger,
  optionalText,
  ratingValue,
  requiredText,
} from './shared.js';

function normalizeTestimonialPayload(payload) {
  return {
    name: requiredText(payload.name, 'Name', 255),
    role: optionalText(payload.role, 255),
    content: requiredText(payload.content, 'Testimonial', 2000),
    rating: ratingValue(payload.rating),
    image_url: optionalText(payload.image_url),
    is_featured: payload.is_featured === false ? 0 : 1,
    display_order: optionalInteger(payload.display_order),
  };
}

export function createAdminEngagementRoutes(deps) {
  const router = Router();

  router.get(
    '/bookings',
    asyncHandler(async (_request, response) => {
      const rows = await deps.query('SELECT * FROM bookings ORDER BY created_at DESC');
      response.json({ data: rows });
    })
  );

  router.put(
    '/bookings/:id/status',
    asyncHandler(async (request, response) => {
      const status = optionalText(request.body?.status, 30) || '';
      if (!BOOKING_STATUSES.has(status)) {
        throw deps.createHttpError(400, 'Unsupported booking status.');
      }

      const existingBooking = await deps.one('SELECT meetlink FROM bookings WHERE id = ? LIMIT 1', [request.params.id]);
      if (!existingBooking) {
        throw deps.createHttpError(404, 'Booking not found.');
      }

      const meetlink = optionalText(request.body?.meetlink) || existingBooking.meetlink || null;
      if (status === 'confirmed' && !meetlink) {
        throw deps.createHttpError(400, 'Confirmed bookings require a meet link.');
      }

      await deps.query(
        `UPDATE bookings
         SET status = ?, meetlink = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [status, meetlink, request.params.id]
      );

      response.json({ data: { success: true } });
    })
  );

  router.put(
    '/bookings/:id/confirm',
    asyncHandler(async (request, response) => {
      const meetlink = requiredText(request.body?.meetlink, 'Meet link');
      await deps.query(
        'UPDATE bookings SET meetlink = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [meetlink, 'confirmed', request.params.id]
      );

      response.json({ data: { success: true } });
    })
  );

  router.delete(
    '/bookings/:id',
    asyncHandler(async (request, response) => {
      await deps.query('DELETE FROM bookings WHERE id = ?', [request.params.id]);
      response.json({ data: { success: true } });
    })
  );

  router.get(
    '/testimonials',
    asyncHandler(async (_request, response) => {
      const rows = await deps.query('SELECT * FROM testimonials ORDER BY display_order ASC, created_at ASC');
      response.json({ data: rows.map(normalizeTestimonial) });
    })
  );

  router.post(
    '/testimonials',
    asyncHandler(async (request, response) => {
      const payload = normalizeTestimonialPayload(request.body ?? {});
      await ensureUniqueTestimonial(deps, payload);
      const displayOrder = payload.display_order ?? (await getNextDisplayOrder(deps, 'testimonials'));

      await deps.query(
        `INSERT INTO testimonials (id, name, role, content, rating, image_url, is_featured, display_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          payload.name,
          payload.role,
          payload.content,
          payload.rating,
          payload.image_url,
          payload.is_featured,
          displayOrder,
        ]
      );

      response.status(201).json({ data: { success: true } });
    })
  );

  router.put(
    '/testimonials/:id',
    asyncHandler(async (request, response) => {
      const payload = normalizeTestimonialPayload(request.body ?? {});
      await ensureUniqueTestimonial(deps, payload, request.params.id);
      const displayOrder = payload.display_order ?? (await getExistingDisplayOrder(deps, 'testimonials', request.params.id));

      await deps.query(
        `UPDATE testimonials SET
          name = ?, role = ?, content = ?, rating = ?, image_url = ?, is_featured = ?,
          display_order = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          payload.name,
          payload.role,
          payload.content,
          payload.rating,
          payload.image_url,
          payload.is_featured,
          displayOrder,
          request.params.id,
        ]
      );

      response.json({ data: { success: true } });
    })
  );

  router.delete(
    '/testimonials/:id',
    asyncHandler(async (request, response) => {
      await deps.query('DELETE FROM testimonials WHERE id = ?', [request.params.id]);
      response.json({ data: { success: true } });
    })
  );

  router.get(
    '/contact-messages',
    asyncHandler(async (_request, response) => {
      const rows = await deps.query('SELECT * FROM contact_messages ORDER BY is_read ASC, created_at DESC');
      response.json({ data: rows.map(normalizeMessage) });
    })
  );

  router.put(
    '/contact-messages/:id/read',
    asyncHandler(async (request, response) => {
      await deps.query(
        'UPDATE contact_messages SET is_read = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [request.body?.is_read ? 1 : 0, request.params.id]
      );

      response.json({ data: { success: true } });
    })
  );

  router.delete(
    '/contact-messages/:id',
    asyncHandler(async (request, response) => {
      await deps.query('DELETE FROM contact_messages WHERE id = ?', [request.params.id]);
      response.json({ data: { success: true } });
    })
  );

  router.get(
    '/analytics/link-clicks',
    asyncHandler(async (request, response) => {
      const limit = integerValue(request.query.limit, 100);
      const rows = await deps.query(
        'SELECT link_title, clicked_at FROM link_clicks ORDER BY clicked_at DESC LIMIT ?',
        [limit > 0 ? limit : 100]
      );
      response.json({ data: rows });
    })
  );

  return router;
}
