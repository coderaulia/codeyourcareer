import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { ANALYTICS_CONVERSION_TYPES } from '../analytics.js';
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

function parseMetadata(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
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
    '/analytics/overview',
    asyncHandler(async (request, response) => {
      const requestedDays = integerValue(request.query.days, 30);
      const days = Math.max(1, Math.min(requestedDays || 30, 365));
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [sessionsRow, pageViewsRow, linkClicksRow, resourceClicksRow, bookingsRow, contactsRow] = await Promise.all([
        deps.one('SELECT COUNT(*) AS count FROM visitor_sessions WHERE started_at >= ?', [since]),
        deps.one(
          'SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = ? AND created_at >= ?',
          ['page_view', since]
        ),
        deps.one(
          'SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = ? AND created_at >= ?',
          ['link_click', since]
        ),
        deps.one(
          'SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = ? AND created_at >= ?',
          ['resource_click', since]
        ),
        deps.one(
          'SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = ? AND created_at >= ?',
          ['booking_submitted', since]
        ),
        deps.one(
          'SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = ? AND created_at >= ?',
          ['contact_submitted', since]
        ),
      ]);

      const [sourceSessions, sourceLeads, campaigns, landingPages, contentClicks, conversions] = await Promise.all([
        deps.query(
          `SELECT source_label, medium_label, COUNT(*) AS sessions
           FROM visitor_sessions
           WHERE started_at >= ?
           GROUP BY source_label, medium_label
           ORDER BY sessions DESC, source_label ASC
           LIMIT 8`,
          [since]
        ),
        deps.query(
          `SELECT source_label, COUNT(*) AS leads
           FROM analytics_events
           WHERE event_type IN ('booking_submitted', 'contact_submitted')
             AND created_at >= ?
           GROUP BY source_label
           ORDER BY leads DESC, source_label ASC`,
          [since]
        ),
        deps.query(
          `SELECT COALESCE(NULLIF(campaign_label, ''), '(none)') AS campaign, COUNT(*) AS sessions
           FROM visitor_sessions
           WHERE started_at >= ?
           GROUP BY COALESCE(NULLIF(campaign_label, ''), '(none)')
           ORDER BY sessions DESC, campaign ASC
           LIMIT 8`,
          [since]
        ),
        deps.query(
          `SELECT landing_path, COUNT(*) AS visits
           FROM visitor_sessions
           WHERE started_at >= ?
           GROUP BY landing_path
           ORDER BY visits DESC, landing_path ASC
           LIMIT 8`,
          [since]
        ),
        deps.query(
          `SELECT
             event_type,
             COALESCE(resource_title, link_title, 'Untitled') AS label,
             COALESCE(resource_table, '') AS resource_table,
             COUNT(*) AS clicks
           FROM analytics_events
           WHERE created_at >= ?
             AND event_type IN ('link_click', 'resource_click')
           GROUP BY event_type, label, resource_table
           ORDER BY clicks DESC, label ASC
           LIMIT 10`,
          [since]
        ),
        deps.query(
          `SELECT event_type, page_path, source_label, medium_label, campaign_label, metadata_json, created_at
           FROM analytics_events
           WHERE event_type IN ('booking_submitted', 'contact_submitted')
             AND created_at >= ?
           ORDER BY created_at DESC
           LIMIT 10`,
          [since]
        ),
      ]);

      const totalSessions = Number(sessionsRow?.count || 0);
      const totalBookings = Number(bookingsRow?.count || 0);
      const totalContacts = Number(contactsRow?.count || 0);
      const totalLeads = totalBookings + totalContacts;

      const sourceLeadMap = new Map(
        sourceLeads.map((row) => [String(row.source_label || 'direct'), Number(row.leads || 0)])
      );

      const topSources = sourceSessions.map((row) => {
        const sessions = Number(row.sessions || 0);
        const leads = sourceLeadMap.get(String(row.source_label || 'direct')) || 0;
        return {
          source: row.source_label || 'direct',
          medium: row.medium_label || 'direct',
          sessions,
          leads,
          conversionRate: sessions ? Number(((leads / sessions) * 100).toFixed(1)) : 0,
        };
      });

      response.json({
        data: {
          rangeDays: days,
          summary: {
            visits: totalSessions,
            pageViews: Number(pageViewsRow?.count || 0),
            linkClicks: Number(linkClicksRow?.count || 0),
            resourceClicks: Number(resourceClicksRow?.count || 0),
            bookings: totalBookings,
            contacts: totalContacts,
            leads: totalLeads,
            conversionRate: totalSessions ? Number(((totalLeads / totalSessions) * 100).toFixed(1)) : 0,
          },
          topSources,
          campaigns: campaigns.map((row) => ({
            campaign: row.campaign,
            sessions: Number(row.sessions || 0),
          })),
          landingPages: landingPages.map((row) => ({
            path: row.landing_path || '/',
            visits: Number(row.visits || 0),
          })),
          contentClicks: contentClicks.map((row) => ({
            label: row.label,
            type: row.event_type,
            table: row.resource_table || null,
            clicks: Number(row.clicks || 0),
          })),
          recentConversions: conversions.map((row) => ({
            type: ANALYTICS_CONVERSION_TYPES.has(row.event_type) ? row.event_type : 'conversion',
            pagePath: row.page_path || '/',
            source: row.source_label || 'direct',
            medium: row.medium_label || 'direct',
            campaign: row.campaign_label || null,
            metadata: parseMetadata(row.metadata_json),
            createdAt: row.created_at,
          })),
        },
      });
    })
  );

  router.get(
    '/analytics/link-clicks',
    asyncHandler(async (request, response) => {
      const limit = Math.max(1, Math.min(integerValue(request.query.limit, 100), 500));
      const rows = await deps.query(
        `SELECT link_title, page_path, source_label, created_at
         FROM analytics_events
         WHERE event_type = 'link_click'
         ORDER BY created_at DESC
         LIMIT ?`,
        [limit]
      );
      response.json({ data: rows });
    })
  );

  return router;
}
