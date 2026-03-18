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

function toCsvValue(value) {
  const normalizedValue = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(normalizedValue)) {
    return `"${normalizedValue.replace(/"/g, '""')}"`;
  }

  return normalizedValue;
}

function toCsv(rows) {
  if (!rows.length) {
    return 'event_type,created_at,page_path,source,medium,campaign,link_title,resource_table,resource_title,booking_id,contact_message_id,metadata_json\n';
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((header) => toCsvValue(row[header])).join(','));
  });
  return `${lines.join('\n')}\n`;
}

function normalizeBreakdownLabel(value, fallback = 'Unknown') {
  const normalizedValue = String(value || '').trim();
  return normalizedValue || fallback;
}

function getPercentChange(current, previous) {
  const safeCurrent = Number(current || 0);
  const safePrevious = Number(previous || 0);
  if (!safePrevious) {
    return safeCurrent ? 100 : 0;
  }

  return Number((((safeCurrent - safePrevious) / safePrevious) * 100).toFixed(1));
}

function createPeriodComparison(key, label, current, previous, options = {}) {
  const percentChange = getPercentChange(current, previous);
  return {
    key,
    label,
    current: Number(current || 0),
    previous: Number(previous || 0),
    delta: Number((Number(current || 0) - Number(previous || 0)).toFixed(options.precision || 0)),
    percentChange,
    suffix: options.suffix || '',
    tone: percentChange > 0 ? 'positive' : percentChange < 0 ? 'negative' : 'neutral',
  };
}

function buildBreakdown(rows, labelField, countField, fallbackLabel = 'Unknown') {
  const items = (rows || []).map((row) => ({
    label: normalizeBreakdownLabel(row?.[labelField], fallbackLabel),
    count: Number(row?.[countField] || 0),
  }));
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return items.map((item) => ({
    ...item,
    percent: total ? Number(((item.count / total) * 100).toFixed(1)) : 0,
  }));
}

function buildDailyTrend(days, since, sessionRows, eventRows) {
  const rowMap = new Map();
  const baseDate = new Date(since);
  baseDate.setHours(0, 0, 0, 0);

  for (let index = 0; index < days; index += 1) {
    const nextDate = new Date(baseDate);
    nextDate.setDate(baseDate.getDate() + index);
    const key = nextDate.toISOString().slice(0, 10);
    rowMap.set(key, {
      day: key,
      visits: 0,
      pageViews: 0,
      linkClicks: 0,
      resourceClicks: 0,
      leads: 0,
    });
  }

  (sessionRows || []).forEach((row) => {
    const existing = rowMap.get(String(row.day_key || ''));
    if (existing) {
      existing.visits = Number(row.visits || 0);
    }
  });

  (eventRows || []).forEach((row) => {
    const existing = rowMap.get(String(row.day_key || ''));
    if (!existing) {
      return;
    }

    const count = Number(row.total || 0);
    switch (row.event_type) {
      case 'page_view':
        existing.pageViews = count;
        break;
      case 'link_click':
        existing.linkClicks = count;
        break;
      case 'resource_click':
        existing.resourceClicks = count;
        break;
      case 'booking_submitted':
      case 'contact_submitted':
        existing.leads += count;
        break;
      default:
        break;
    }
  });

  return Array.from(rowMap.values()).map((item) => ({
    ...item,
    trackedClicks: item.linkClicks + item.resourceClicks,
  }));
}

function buildContentMomentum(currentRows, previousRows) {
  const previousMap = new Map(
    (previousRows || []).map((row) => [String(row.item_key || ''), Number(row.clicks || 0)])
  );

  return (currentRows || []).map((row) => {
    const currentClicks = Number(row.clicks || 0);
    const previousClicks = previousMap.get(String(row.item_key || '')) || 0;
    return {
      key: row.item_key,
      label: row.label,
      type: row.event_type,
      table: row.resource_table || null,
      currentClicks,
      previousClicks,
      delta: currentClicks - previousClicks,
      percentChange: getPercentChange(currentClicks, previousClicks),
    };
  });
}

function buildAnomalyAlerts(days, comparisons) {
  const alerts = [];

  comparisons.forEach((item) => {
    const baseline = Math.max(item.current, item.previous);
    const absolutePercent = Math.abs(Number(item.percentChange || 0));
    if (item.key === 'conversionRate') {
      if (Math.max(item.current, item.previous) < 1 || absolutePercent < 20) {
        return;
      }
    } else if (baseline < 5 || absolutePercent < 25) {
      return;
    }

    const direction = Number(item.percentChange || 0) >= 0 ? 'up' : 'down';
    alerts.push({
      key: item.key,
      tone: item.tone,
      label: item.label,
      current: item.current,
      previous: item.previous,
      percentChange: item.percentChange,
      message: `${item.label} ${direction} ${Math.abs(item.percentChange)}% vs the previous ${days}-day period.`,
    });
  });

  if (!alerts.length) {
    return [
      {
        key: 'stable',
        tone: 'neutral',
        label: 'Stable trend',
        current: 0,
        previous: 0,
        percentChange: 0,
        message: `No major swings detected versus the previous ${days}-day period.`,
      },
    ];
  }

  return alerts.sort((left, right) => Math.abs(right.percentChange) - Math.abs(left.percentChange)).slice(0, 4);
}

function buildClientReport(days, summary, topSources, landingPages, contentMomentum, deviceBreakdown, geoBreakdown, alerts) {
  const wins = [];
  const watchouts = [];
  const topSource = topSources?.[0];
  const topLanding = landingPages?.[0];
  const topContent = contentMomentum?.[0];
  const topDevice = deviceBreakdown?.[0];
  const topCountry = geoBreakdown?.[0];

  if (topSource?.sessions) {
    wins.push(
      `${topSource.source} / ${topSource.medium} drove ${topSource.sessions} visits and ${topSource.leads} leads.`
    );
  }

  if (topLanding?.visits) {
    wins.push(`${topLanding.path} was the strongest landing page with ${topLanding.visits} visits.`);
  }

  if (topContent?.currentClicks) {
    wins.push(`${topContent.label} generated ${topContent.currentClicks} clicks in the last ${days} days.`);
  }

  if (topDevice?.count) {
    wins.push(`${topDevice.label} made up ${topDevice.percent}% of tracked sessions.`);
  }

  if (topCountry?.count) {
    wins.push(`${topCountry.label} was the top geo signal at ${topCountry.percent}% of sessions.`);
  }

  alerts
    .filter((item) => item.tone === 'negative')
    .forEach((item) => watchouts.push(item.message));

  if (!watchouts.length && summary.visits < 20) {
    watchouts.push('Traffic volume is still low, so trend signals may change quickly.');
  }

  if (!watchouts.length) {
    watchouts.push('No major risk signals were detected in the current reporting window.');
  }

  const headline = `${summary.visits} visits, ${summary.leads} leads, and ${summary.conversionRate}% conversion in the last ${days} days.`;
  const reportLines = [
    `CodeYourCareer analytics snapshot (${days} days)`,
    headline,
    '',
    'Wins:',
    ...wins.map((item) => `- ${item}`),
    '',
    'Watchouts:',
    ...watchouts.map((item) => `- ${item}`),
  ];

  return {
    headline,
    wins: wins.slice(0, 4),
    watchouts: watchouts.slice(0, 3),
    summaryText: reportLines.join('\n'),
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
    '/analytics/overview',
    asyncHandler(async (request, response) => {
      const requestedDays = integerValue(request.query.days, 30);
      const days = Math.max(1, Math.min(requestedDays || 30, 365));
      const now = new Date();
      const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const previousSince = new Date(since.getTime() - days * 24 * 60 * 60 * 1000);

      const [
        sessionsRow,
        previousSessionsRow,
        pageViewsRow,
        previousPageViewsRow,
        linkClicksRow,
        previousLinkClicksRow,
        resourceClicksRow,
        previousResourceClicksRow,
        bookingsRow,
        previousBookingsRow,
        contactsRow,
        previousContactsRow,
      ] = await Promise.all([
        deps.one('SELECT COUNT(*) AS count FROM visitor_sessions WHERE started_at >= ?', [since]),
        deps.one('SELECT COUNT(*) AS count FROM visitor_sessions WHERE started_at >= ? AND started_at < ?', [previousSince, since]),
        deps.one(
          'SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = ? AND created_at >= ?',
          ['page_view', since]
        ),
        deps.one(
          'SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = ? AND created_at >= ? AND created_at < ?',
          ['page_view', previousSince, since]
        ),
        deps.one(
          'SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = ? AND created_at >= ?',
          ['link_click', since]
        ),
        deps.one(
          'SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = ? AND created_at >= ? AND created_at < ?',
          ['link_click', previousSince, since]
        ),
        deps.one(
          'SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = ? AND created_at >= ?',
          ['resource_click', since]
        ),
        deps.one(
          'SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = ? AND created_at >= ? AND created_at < ?',
          ['resource_click', previousSince, since]
        ),
        deps.one(
          'SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = ? AND created_at >= ?',
          ['booking_submitted', since]
        ),
        deps.one(
          'SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = ? AND created_at >= ? AND created_at < ?',
          ['booking_submitted', previousSince, since]
        ),
        deps.one(
          'SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = ? AND created_at >= ?',
          ['contact_submitted', since]
        ),
        deps.one(
          'SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = ? AND created_at >= ? AND created_at < ?',
          ['contact_submitted', previousSince, since]
        ),
      ]);

      const [
        sourceSessions,
        sourceLeads,
        campaigns,
        landingPages,
        contentClicks,
        previousContentClicks,
        conversions,
        deviceRows,
        browserRows,
        geoRows,
        sessionTrendRows,
        eventTrendRows,
      ] = await Promise.all([
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
             COALESCE(resource_id, link_id, CONCAT(event_type, ':', COALESCE(resource_title, link_title, 'Untitled'))) AS item_key,
             COUNT(*) AS clicks
           FROM analytics_events
           WHERE created_at >= ?
             AND event_type IN ('link_click', 'resource_click')
           GROUP BY event_type, label, resource_table,
             COALESCE(resource_id, link_id, CONCAT(event_type, ':', COALESCE(resource_title, link_title, 'Untitled')))
           ORDER BY clicks DESC, label ASC
           LIMIT 10`,
          [since]
        ),
        deps.query(
          `SELECT
             event_type,
             COALESCE(resource_table, '') AS resource_table,
             COALESCE(resource_id, link_id, CONCAT(event_type, ':', COALESCE(resource_title, link_title, 'Untitled'))) AS item_key,
             COALESCE(resource_title, link_title, 'Untitled') AS label,
             COUNT(*) AS clicks
           FROM analytics_events
           WHERE created_at >= ?
             AND created_at < ?
             AND event_type IN ('link_click', 'resource_click')
           GROUP BY event_type, resource_table, item_key, label
           ORDER BY clicks DESC, label ASC
           LIMIT 20`,
          [previousSince, since]
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
        deps.query(
          `SELECT COALESCE(NULLIF(device_type, ''), 'unknown') AS label, COUNT(*) AS sessions
           FROM visitor_sessions
           WHERE started_at >= ?
           GROUP BY COALESCE(NULLIF(device_type, ''), 'unknown')
           ORDER BY sessions DESC, label ASC`,
          [since]
        ),
        deps.query(
          `SELECT COALESCE(NULLIF(browser, ''), 'Unknown') AS label, COUNT(*) AS sessions
           FROM visitor_sessions
           WHERE started_at >= ?
           GROUP BY COALESCE(NULLIF(browser, ''), 'Unknown')
           ORDER BY sessions DESC, label ASC
           LIMIT 8`,
          [since]
        ),
        deps.query(
          `SELECT COALESCE(NULLIF(country_code, ''), 'Unknown') AS label, COUNT(*) AS sessions
           FROM visitor_sessions
           WHERE started_at >= ?
           GROUP BY COALESCE(NULLIF(country_code, ''), 'Unknown')
           ORDER BY sessions DESC, label ASC
           LIMIT 8`,
          [since]
        ),
        deps.query(
          `SELECT DATE_FORMAT(started_at, '%Y-%m-%d') AS day_key, COUNT(*) AS visits
           FROM visitor_sessions
           WHERE started_at >= ?
           GROUP BY day_key
           ORDER BY day_key ASC`,
          [since]
        ),
        deps.query(
          `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day_key, event_type, COUNT(*) AS total
           FROM analytics_events
           WHERE created_at >= ?
             AND event_type IN ('page_view', 'link_click', 'resource_click', 'booking_submitted', 'contact_submitted')
           GROUP BY day_key, event_type
           ORDER BY day_key ASC`,
          [since]
        ),
      ]);

      const totalSessions = Number(sessionsRow?.count || 0);
      const previousSessions = Number(previousSessionsRow?.count || 0);
      const totalPageViews = Number(pageViewsRow?.count || 0);
      const previousPageViews = Number(previousPageViewsRow?.count || 0);
      const totalLinkClicks = Number(linkClicksRow?.count || 0);
      const previousLinkClicks = Number(previousLinkClicksRow?.count || 0);
      const totalResourceClicks = Number(resourceClicksRow?.count || 0);
      const previousResourceClicks = Number(previousResourceClicksRow?.count || 0);
      const totalBookings = Number(bookingsRow?.count || 0);
      const previousBookings = Number(previousBookingsRow?.count || 0);
      const totalContacts = Number(contactsRow?.count || 0);
      const previousContacts = Number(previousContactsRow?.count || 0);
      const totalLeads = totalBookings + totalContacts;
      const previousLeads = previousBookings + previousContacts;
      const totalTrackedClicks = totalLinkClicks + totalResourceClicks;
      const previousTrackedClicks = previousLinkClicks + previousResourceClicks;

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

      const summary = {
        visits: totalSessions,
        pageViews: totalPageViews,
        linkClicks: totalLinkClicks,
        resourceClicks: totalResourceClicks,
        bookings: totalBookings,
        contacts: totalContacts,
        leads: totalLeads,
        conversionRate: totalSessions ? Number(((totalLeads / totalSessions) * 100).toFixed(1)) : 0,
      };

      const previousSummary = {
        visits: previousSessions,
        pageViews: previousPageViews,
        trackedClicks: previousTrackedClicks,
        leads: previousLeads,
        conversionRate: previousSessions ? Number(((previousLeads / previousSessions) * 100).toFixed(1)) : 0,
      };

      const periodComparisons = [
        createPeriodComparison('visits', 'Visits', summary.visits, previousSummary.visits),
        createPeriodComparison('pageViews', 'Page Views', summary.pageViews, previousSummary.pageViews),
        createPeriodComparison('trackedClicks', 'Tracked Clicks', totalTrackedClicks, previousSummary.trackedClicks),
        createPeriodComparison('leads', 'Leads', summary.leads, previousSummary.leads),
        createPeriodComparison(
          'conversionRate',
          'Conversion Rate',
          summary.conversionRate,
          previousSummary.conversionRate,
          { precision: 1, suffix: '%' }
        ),
      ];

      const contentMomentum = buildContentMomentum(
        contentClicks.map((row) => ({
          ...row,
          item_key:
            row.item_key ||
            `${row.event_type}:${row.resource_table || ''}:${String(row.label || '').toLowerCase()}`,
        })),
        previousContentClicks
      );
      const deviceBreakdown = buildBreakdown(deviceRows, 'label', 'sessions', 'unknown');
      const browserBreakdown = buildBreakdown(browserRows, 'label', 'sessions', 'Unknown');
      const geoBreakdown = buildBreakdown(geoRows, 'label', 'sessions', 'Unknown');
      const dailyTrend = buildDailyTrend(days, since, sessionTrendRows, eventTrendRows);
      const anomalyAlerts = buildAnomalyAlerts(days, periodComparisons);
      const clientReport = buildClientReport(
        days,
        summary,
        topSources,
        landingPages.map((row) => ({
          path: row.landing_path || '/',
          visits: Number(row.visits || 0),
        })),
        contentMomentum,
        deviceBreakdown,
        geoBreakdown,
        anomalyAlerts
      );

      response.json({
        data: {
          rangeDays: days,
          summary,
          previousSummary,
          periodComparisons,
          anomalyAlerts,
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
          contentMomentum: contentMomentum.slice(0, 8),
          breakdowns: {
            devices: deviceBreakdown,
            browsers: browserBreakdown,
            countries: geoBreakdown,
          },
          dailyTrend,
          recentConversions: conversions.map((row) => ({
            type: ANALYTICS_CONVERSION_TYPES.has(row.event_type) ? row.event_type : 'conversion',
            pagePath: row.page_path || '/',
            source: row.source_label || 'direct',
            medium: row.medium_label || 'direct',
            campaign: row.campaign_label || null,
            metadata: parseMetadata(row.metadata_json),
            createdAt: row.created_at,
          })),
          clientReport,
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

  router.get(
    '/analytics/export.csv',
    asyncHandler(async (request, response) => {
      const requestedDays = integerValue(request.query.days, 30);
      const days = Math.max(1, Math.min(requestedDays || 30, 365));
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const rows = await deps.query(
        `SELECT
           e.event_type AS event_type,
           e.created_at AS created_at,
           e.page_path AS page_path,
           e.source_label AS source,
           e.medium_label AS medium,
           e.campaign_label AS campaign,
           e.link_title AS link_title,
           e.resource_table AS resource_table,
           e.resource_title AS resource_title,
           e.booking_id AS booking_id,
           e.contact_message_id AS contact_message_id,
           e.metadata_json AS metadata_json
         FROM analytics_events e
         WHERE e.created_at >= ?
         ORDER BY e.created_at DESC
         LIMIT 5000`,
        [since]
      );

      response.setHeader('Content-Type', 'text/csv; charset=utf-8');
      response.setHeader(
        'Content-Disposition',
        `attachment; filename="cyc-analytics-${days}d.csv"`
      );
      response.send(toCsv(rows));
    })
  );

  return router;
}
