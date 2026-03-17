import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { ensureVisitorSession, trackAnalyticsEvent } from '../analytics.js';
import { logWarn } from '../logger.js';
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

async function captureAnalyticsEventSafely(deps, request, payload) {
  try {
    await trackAnalyticsEvent(deps, request, payload);
  } catch (error) {
    logWarn('analytics_capture_failed', {
      requestId: request.requestId,
      path: request.originalUrl,
      eventType: payload.eventType,
      message: error.message,
    });
  }
}

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
    '/analytics/session',
    asyncHandler(async (request, response) => {
      const session = await ensureVisitorSession(deps, request, {
        sessionId: optionalText(request.body?.sessionId, 36),
        pagePath: optionalText(request.body?.pagePath, 255) || '/',
        referrer: optionalText(request.body?.referrer, 2048),
        utmSource: optionalText(request.body?.utmSource, 255),
        utmMedium: optionalText(request.body?.utmMedium, 255),
        utmCampaign: optionalText(request.body?.utmCampaign, 255),
        utmContent: optionalText(request.body?.utmContent, 255),
        utmTerm: optionalText(request.body?.utmTerm, 255),
      });

      response.status(201).json({
        data: {
          success: true,
          sessionId: session.id,
          sourceLabel: session.sourceLabel,
          mediumLabel: session.mediumLabel,
          campaignLabel: session.campaignLabel,
        },
      });
    })
  );

  router.post(
    '/analytics/events',
    asyncHandler(async (request, response) => {
      const result = await trackAnalyticsEvent(deps, request, {
        sessionId: optionalText(request.body?.sessionId, 36),
        eventType: requiredText(request.body?.eventType, 'Analytics event type', 60),
        pagePath: optionalText(request.body?.pagePath, 255) || '/',
        referrer: optionalText(request.body?.referrer, 2048),
        utmSource: optionalText(request.body?.utmSource, 255),
        utmMedium: optionalText(request.body?.utmMedium, 255),
        utmCampaign: optionalText(request.body?.utmCampaign, 255),
        utmContent: optionalText(request.body?.utmContent, 255),
        utmTerm: optionalText(request.body?.utmTerm, 255),
        linkId: optionalText(request.body?.linkId, 36),
        linkTitle: optionalText(request.body?.linkTitle, 255),
        resourceTable: optionalText(request.body?.resourceTable, 40),
        resourceId: optionalText(request.body?.resourceId, 36),
        resourceTitle: optionalText(request.body?.resourceTitle, 255),
        bookingId: optionalText(request.body?.bookingId, 36),
        contactMessageId: optionalText(request.body?.contactMessageId, 36),
        metadata: request.body?.metadata,
      });

      response.status(201).json({ data: { success: true, ...result } });
    })
  );

  router.post(
    '/bookings',
    asyncHandler(async (request, response) => {
      const name = requiredText(request.body?.name, 'Name', 255);
      const email = requiredEmail(request.body?.email, deps.normalizeEmail);
      const topic = requiredText(request.body?.topic, 'Topic', 255);
      const schedule = requiredText(request.body?.schedule, 'Schedule');
      const bookingId = randomUUID();

      await deps.query(
        'INSERT INTO bookings (id, name, email, topic, schedule, status) VALUES (?, ?, ?, ?, ?, ?)',
        [bookingId, name, email, topic, schedule, 'pending']
      );

      if (request.body?.analyticsEnabled) {
        await captureAnalyticsEventSafely(deps, request, {
          sessionId: optionalText(request.body?.analyticsSessionId, 36),
          eventType: 'booking_submitted',
          pagePath: optionalText(request.body?.pagePath, 255) || '/#consultation',
          bookingId,
          metadata: {
            topic,
            schedule,
          },
        });
      }

      response.status(201).json({ data: { success: true, id: bookingId } });
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
      const messageId = randomUUID();

      await deps.query(
        'INSERT INTO contact_messages (id, name, email, message, is_read) VALUES (?, ?, ?, ?, ?)',
        [messageId, name, email, message, 0]
      );

      if (request.body?.analyticsEnabled) {
        await captureAnalyticsEventSafely(deps, request, {
          sessionId: optionalText(request.body?.analyticsSessionId, 36),
          eventType: 'contact_submitted',
          pagePath: optionalText(request.body?.pagePath, 255) || '/#contact',
          contactMessageId: messageId,
          metadata: {
            messageLength: message.length,
          },
        });
      }

      response.status(201).json({ data: { success: true, id: messageId } });
    })
  );

  router.post(
    '/link-clicks',
    asyncHandler(async (request, response) => {
      await trackAnalyticsEvent(deps, request, {
        sessionId: optionalText(request.body?.sessionId, 36),
        eventType: 'link_click',
        pagePath: optionalText(request.body?.pagePath, 255) || '/',
        referrer: optionalText(request.body?.referrer, 2048),
        utmSource: optionalText(request.body?.utmSource, 255),
        utmMedium: optionalText(request.body?.utmMedium, 255),
        utmCampaign: optionalText(request.body?.utmCampaign, 255),
        utmContent: optionalText(request.body?.utmContent, 255),
        utmTerm: optionalText(request.body?.utmTerm, 255),
        linkId: optionalText(request.body?.linkId, 36),
        linkTitle: optionalText(request.body?.linkTitle, 255),
        metadata: request.body?.metadata,
      });

      response.status(201).json({ data: { success: true } });
    })
  );

  return router;
}
