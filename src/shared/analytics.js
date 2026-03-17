import { createAnalyticsSession, recordAnalyticsEvent } from '../api/data.js';

const sessionStorageKey = 'cyc_analytics_session';
const sessionTimeoutMs = 30 * 60 * 1000;

let sessionState = null;
let sessionPromise = null;
let initialPageViewTracked = false;

function now() {
  return Date.now();
}

function createSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `cyc-${now()}-${Math.random().toString(16).slice(2)}`;
}

function readStoredSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (sessionState) {
    return sessionState;
  }

  try {
    const rawValue = window.localStorage.getItem(sessionStorageKey);
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);
    if (!parsedValue?.id) {
      return null;
    }

    sessionState = parsedValue;
    return sessionState;
  } catch {
    return null;
  }
}

function writeStoredSession(nextState) {
  sessionState = nextState;
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(sessionStorageKey, JSON.stringify(nextState));
}

function buildCurrentPagePath(fragment = '') {
  if (typeof window === 'undefined') {
    return fragment || '/';
  }

  const basePath = `${window.location.pathname || '/'}${window.location.search || ''}`;
  if (!fragment) {
    return basePath || '/';
  }

  return `${basePath}${fragment.startsWith('#') ? fragment : `#${fragment}`}`;
}

function getAttributionPayload() {
  if (typeof window === 'undefined') {
    return {};
  }

  const params = new URLSearchParams(window.location.search);
  return {
    referrer: document.referrer || '',
    utmSource: params.get('utm_source') || '',
    utmMedium: params.get('utm_medium') || '',
    utmCampaign: params.get('utm_campaign') || '',
    utmContent: params.get('utm_content') || '',
    utmTerm: params.get('utm_term') || '',
  };
}

function isSessionExpired(session) {
  if (!session?.lastActivityAt) {
    return true;
  }

  return now() - Number(session.lastActivityAt) > sessionTimeoutMs;
}

async function createOrRefreshSession(pagePath) {
  const existingSession = readStoredSession();
  const sessionId = existingSession && !isSessionExpired(existingSession) ? existingSession.id : createSessionId();

  const result = await createAnalyticsSession({
    sessionId,
    pagePath,
    ...getAttributionPayload(),
  });

  const nextState = {
    id: result?.sessionId || sessionId,
    lastActivityAt: now(),
  };
  writeStoredSession(nextState);
  return nextState.id;
}

export async function initializeAnalyticsTracking() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!sessionPromise) {
    const pagePath = buildCurrentPagePath();
    sessionPromise = createOrRefreshSession(pagePath).finally(() => {
      sessionPromise = null;
    });
  }

  const sessionId = await sessionPromise;
  if (!initialPageViewTracked) {
    initialPageViewTracked = true;
    await trackAnalyticsEvent('page_view', { pagePath: buildCurrentPagePath(), sessionId });
  }

  return sessionId;
}

export async function getAnalyticsSessionId() {
  const existingSession = readStoredSession();
  if (existingSession && !isSessionExpired(existingSession)) {
    writeStoredSession({
      ...existingSession,
      lastActivityAt: now(),
    });
    return existingSession.id;
  }

  return initializeAnalyticsTracking();
}

export async function trackAnalyticsEvent(eventType, payload = {}) {
  try {
    const sessionId = payload.sessionId || (await getAnalyticsSessionId());
    if (!sessionId) {
      return null;
    }

    writeStoredSession({
      id: sessionId,
      lastActivityAt: now(),
    });

    return recordAnalyticsEvent({
      sessionId,
      eventType,
      pagePath: payload.pagePath || buildCurrentPagePath(),
      ...getAttributionPayload(),
      ...payload,
    });
  } catch (error) {
    console.debug('Analytics tracking skipped:', error.message);
    return null;
  }
}

export function getAnalyticsContext(pagePath = '') {
  const session = readStoredSession();
  return {
    analyticsSessionId: session?.id || '',
    pagePath: pagePath || buildCurrentPagePath(),
  };
}

export async function trackSectionView(sectionId) {
  if (!sectionId) {
    return null;
  }

  return trackAnalyticsEvent('section_view', {
    pagePath: buildCurrentPagePath(`#${sectionId}`),
    metadata: {
      sectionId,
    },
  });
}

export async function trackResourceClick(table, item) {
  if (!item) {
    return null;
  }

  return trackAnalyticsEvent('resource_click', {
    resourceTable: table,
    resourceId: item.id,
    resourceTitle: item.title,
    pagePath: buildCurrentPagePath(`#${table}`),
    metadata: {
      url: item.link,
    },
  });
}
