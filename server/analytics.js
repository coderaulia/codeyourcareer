import { randomUUID } from 'node:crypto';
import { createHttpError } from './logger.js';

export const ANALYTICS_EVENT_TYPES = new Set([
  'page_view',
  'section_view',
  'link_click',
  'resource_click',
  'booking_submitted',
  'contact_submitted',
]);

export const ANALYTICS_CONVERSION_TYPES = new Set(['booking_submitted', 'contact_submitted']);

function cleanText(value, maxLength = null) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return null;
  }

  if (maxLength && normalizedValue.length > maxLength) {
    return normalizedValue.slice(0, maxLength);
  }

  return normalizedValue;
}

function cleanLowerText(value, maxLength = null) {
  const normalizedValue = cleanText(value, maxLength);
  return normalizedValue ? normalizedValue.toLowerCase() : null;
}

function cleanPath(value) {
  const normalizedValue = cleanText(value, 255);
  if (!normalizedValue) {
    return '/';
  }

  if (normalizedValue.startsWith('/')) {
    return normalizedValue;
  }

  if (normalizedValue.startsWith('#')) {
    return `/${normalizedValue}`;
  }

  return `/${normalizedValue}`;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '').trim()
  );
}

function extractReferrerHost(referrer) {
  const normalizedValue = cleanText(referrer, 2048);
  if (!normalizedValue) {
    return null;
  }

  try {
    return new URL(normalizedValue).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
}

function detectBrowser(userAgent) {
  const agent = String(userAgent || '').toLowerCase();
  if (!agent) {
    return 'Unknown';
  }

  if (agent.includes('edg/')) {
    return 'Edge';
  }
  if (agent.includes('chrome/')) {
    return 'Chrome';
  }
  if (agent.includes('safari/') && !agent.includes('chrome/')) {
    return 'Safari';
  }
  if (agent.includes('firefox/')) {
    return 'Firefox';
  }
  if (agent.includes('opr/') || agent.includes('opera')) {
    return 'Opera';
  }

  return 'Other';
}

function detectOs(userAgent) {
  const agent = String(userAgent || '').toLowerCase();
  if (!agent) {
    return 'Unknown';
  }

  if (agent.includes('windows')) {
    return 'Windows';
  }
  if (agent.includes('android')) {
    return 'Android';
  }
  if (agent.includes('iphone') || agent.includes('ipad') || agent.includes('ios')) {
    return 'iOS';
  }
  if (agent.includes('mac os x') || agent.includes('macintosh')) {
    return 'macOS';
  }
  if (agent.includes('linux')) {
    return 'Linux';
  }

  return 'Other';
}

function detectDeviceType(userAgent) {
  const agent = String(userAgent || '').toLowerCase();
  if (!agent) {
    return 'unknown';
  }

  if (agent.includes('ipad') || agent.includes('tablet')) {
    return 'tablet';
  }
  if (
    agent.includes('mobile') ||
    agent.includes('iphone') ||
    agent.includes('android') ||
    agent.includes('phone')
  ) {
    return 'mobile';
  }

  return 'desktop';
}

function detectCountryCode(request) {
  const value =
    request.headers['cf-ipcountry'] ||
    request.headers['x-vercel-ip-country'] ||
    request.headers['x-country-code'] ||
    '';

  return cleanUpperText(value, 8);
}

function cleanUpperText(value, maxLength = null) {
  const normalizedValue = cleanText(value, maxLength);
  return normalizedValue ? normalizedValue.toUpperCase() : null;
}

function isBotUserAgent(userAgent) {
  return /bot|crawler|spider|preview|facebookexternalhit|slurp|bingpreview|headless/i.test(
    String(userAgent || '')
  );
}

function resolveAttribution({ utmSource, utmMedium, utmCampaign, referrerHost }) {
  if (utmSource) {
    return {
      sourceLabel: utmSource,
      mediumLabel: utmMedium || 'campaign',
      campaignLabel: utmCampaign || null,
    };
  }

  if (referrerHost) {
    return {
      sourceLabel: referrerHost,
      mediumLabel: 'referral',
      campaignLabel: utmCampaign || null,
    };
  }

  return {
    sourceLabel: 'direct',
    mediumLabel: 'direct',
    campaignLabel: utmCampaign || null,
  };
}

function serializeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  try {
    return JSON.stringify(metadata);
  } catch {
    return null;
  }
}

function buildSessionInput(request, payload = {}) {
  const sessionId = isUuid(payload.sessionId) ? payload.sessionId : randomUUID();
  const pagePath = cleanPath(payload.pagePath || request.body?.pagePath || request.originalUrl || '/');
  const referrer = cleanText(payload.referrer || request.body?.referrer || request.headers.referer, 2048);
  const referrerHost = extractReferrerHost(referrer);
  const utmSource = cleanLowerText(payload.utmSource || request.body?.utmSource, 255);
  const utmMedium = cleanLowerText(payload.utmMedium || request.body?.utmMedium, 255);
  const utmCampaign = cleanText(payload.utmCampaign || request.body?.utmCampaign, 255);
  const utmContent = cleanText(payload.utmContent || request.body?.utmContent, 255);
  const utmTerm = cleanText(payload.utmTerm || request.body?.utmTerm, 255);
  const userAgent = cleanText(request.headers['user-agent'], 1024);
  const attribution = resolveAttribution({ utmSource, utmMedium, utmCampaign, referrerHost });

  return {
    id: sessionId,
    landingPath: pagePath,
    lastPath: pagePath,
    landingReferrer: referrer,
    lastReferrer: referrer,
    referrerHost,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
    sourceLabel: attribution.sourceLabel,
    mediumLabel: attribution.mediumLabel,
    campaignLabel: attribution.campaignLabel,
    browser: detectBrowser(userAgent),
    os: detectOs(userAgent),
    deviceType: detectDeviceType(userAgent),
    countryCode: detectCountryCode(request),
    isBot: isBotUserAgent(userAgent) ? 1 : 0,
  };
}

export async function ensureVisitorSession(deps, request, payload = {}) {
  const input = buildSessionInput(request, payload);
  const existing = await deps.one('SELECT * FROM visitor_sessions WHERE id = ? LIMIT 1', [input.id]);

  if (existing) {
    const hasAttribution =
      Boolean(existing.utm_source) ||
      Boolean(existing.utm_medium) ||
      Boolean(existing.utm_campaign) ||
      Boolean(existing.referrer_host);

    const nextSourceLabel = hasAttribution ? existing.source_label || 'direct' : input.sourceLabel;
    const nextMediumLabel = hasAttribution ? existing.medium_label || 'direct' : input.mediumLabel;
    const nextCampaignLabel = existing.campaign_label || input.campaignLabel;

    await deps.query(
      `UPDATE visitor_sessions
       SET last_seen_at = CURRENT_TIMESTAMP,
           landing_path = ?,
           last_path = ?,
           landing_referrer = ?,
           last_referrer = ?,
           referrer_host = ?,
           utm_source = ?,
           utm_medium = ?,
           utm_campaign = ?,
           utm_content = ?,
           utm_term = ?,
           source_label = ?,
           medium_label = ?,
           campaign_label = ?,
           browser = ?,
           os = ?,
           device_type = ?,
           country_code = ?,
           is_bot = ?
       WHERE id = ?`,
      [
        existing.landing_path || input.landingPath,
        input.lastPath,
        existing.landing_referrer || input.landingReferrer,
        input.lastReferrer || existing.last_referrer || existing.landing_referrer,
        existing.referrer_host || input.referrerHost,
        existing.utm_source || input.utmSource,
        existing.utm_medium || input.utmMedium,
        existing.utm_campaign || input.utmCampaign,
        existing.utm_content || input.utmContent,
        existing.utm_term || input.utmTerm,
        nextSourceLabel,
        nextMediumLabel,
        nextCampaignLabel,
        existing.browser || input.browser,
        existing.os || input.os,
        existing.device_type || input.deviceType,
        existing.country_code || input.countryCode,
        existing.is_bot ? 1 : input.isBot,
        input.id,
      ]
    );

    return {
      id: input.id,
      sourceLabel: nextSourceLabel,
      mediumLabel: nextMediumLabel,
      campaignLabel: nextCampaignLabel,
    };
  }

  await deps.query(
    `INSERT INTO visitor_sessions (
      id, landing_path, last_path, landing_referrer, last_referrer, referrer_host,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      source_label, medium_label, campaign_label,
      browser, os, device_type, country_code, is_bot
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.landingPath,
      input.lastPath,
      input.landingReferrer,
      input.lastReferrer,
      input.referrerHost,
      input.utmSource,
      input.utmMedium,
      input.utmCampaign,
      input.utmContent,
      input.utmTerm,
      input.sourceLabel,
      input.mediumLabel,
      input.campaignLabel,
      input.browser,
      input.os,
      input.deviceType,
      input.countryCode,
      input.isBot,
    ]
  );

  return {
    id: input.id,
    sourceLabel: input.sourceLabel,
    mediumLabel: input.mediumLabel,
    campaignLabel: input.campaignLabel,
  };
}

export async function trackAnalyticsEvent(deps, request, payload = {}) {
  const eventType = cleanLowerText(payload.eventType, 60);
  if (!ANALYTICS_EVENT_TYPES.has(eventType)) {
    throw createHttpError(400, 'Unsupported analytics event type.');
  }

  const session = await ensureVisitorSession(deps, request, payload);
  const eventId = randomUUID();
  const pagePath = cleanPath(payload.pagePath || request.body?.pagePath || request.originalUrl || '/');
  const linkId = isUuid(payload.linkId) ? payload.linkId : null;
  const bookingId = isUuid(payload.bookingId) ? payload.bookingId : null;
  const contactMessageId = isUuid(payload.contactMessageId) ? payload.contactMessageId : null;
  const resourceId = isUuid(payload.resourceId) ? payload.resourceId : null;
  const metadataJson = serializeMetadata(payload.metadata || request.body?.metadata);

  await deps.query(
    `INSERT INTO analytics_events (
      id, session_id, event_type, page_path, link_id, link_title,
      resource_table, resource_id, resource_title, booking_id, contact_message_id,
      source_label, medium_label, campaign_label, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      eventId,
      session.id,
      eventType,
      pagePath,
      linkId,
      cleanText(payload.linkTitle, 255),
      cleanLowerText(payload.resourceTable, 40),
      resourceId,
      cleanText(payload.resourceTitle, 255),
      bookingId,
      contactMessageId,
      session.sourceLabel,
      session.mediumLabel,
      session.campaignLabel,
      metadataJson,
    ]
  );

  if (eventType === 'link_click' && (linkId || payload.linkTitle)) {
    await deps.query(
      'INSERT INTO link_clicks (id, link_id, link_title) VALUES (?, ?, ?)',
      [randomUUID(), linkId, cleanText(payload.linkTitle, 255)]
    );
  }

  return {
    eventId,
    sessionId: session.id,
    sourceLabel: session.sourceLabel,
    mediumLabel: session.mediumLabel,
    campaignLabel: session.campaignLabel,
  };
}
