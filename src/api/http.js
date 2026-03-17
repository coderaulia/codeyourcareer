const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
const apiBaseUrl = configuredApiBaseUrl.endsWith('/api')
  ? configuredApiBaseUrl.slice(0, -4)
  : configuredApiBaseUrl;
const csrfStorageKey = 'cyc_admin_csrf_token';

let currentCsrfToken =
  typeof window !== 'undefined' ? window.sessionStorage.getItem(csrfStorageKey) || '' : '';

function createApiError(message, statusCode, requestId) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.requestId = requestId || null;
  return error;
}

function dispatchAuthEvent(type, detail = {}) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent('cyc:auth-state', { detail: { type, ...detail } }));
}

export function setCsrfToken(token) {
  currentCsrfToken = String(token || '');
  if (typeof window !== 'undefined') {
    if (currentCsrfToken) {
      window.sessionStorage.setItem(csrfStorageKey, currentCsrfToken);
    } else {
      window.sessionStorage.removeItem(csrfStorageKey);
    }
  }
}

export function clearCsrfToken() {
  setCsrfToken('');
}

export function getApiRoot() {
  return `${apiBaseUrl}/api`;
}

function syncSecurityState(data) {
  if (!data || typeof data !== 'object') {
    return;
  }

  if ('csrfToken' in data) {
    setCsrfToken(data.csrfToken || '');
  }

  if ('authenticated' in data && !data.authenticated) {
    clearCsrfToken();
  }
}

export async function apiRequest(path, options = {}) {
  const { body, headers = {}, method = 'GET', signal, keepalive = false } = options;
  const upperMethod = method.toUpperCase();

  let response;
  try {
    response = await fetch(`${apiBaseUrl}/api${path}`, {
      method: upperMethod,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(upperMethod !== 'GET' && currentCsrfToken ? { 'X-CSRF-Token': currentCsrfToken } : {}),
        ...headers,
      },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
      signal,
      keepalive,
    });
  } catch {
    throw createApiError('Unable to reach the server. Please check your connection and try again.', 0);
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;
  const requestId = payload?.requestId || response.headers.get('x-request-id');
  syncSecurityState(payload?.data);

  if (!response.ok) {
    if (response.status === 401) {
      clearCsrfToken();
      dispatchAuthEvent('expired', { path });
    }

    const fallbackMessage =
      response.status >= 500
        ? 'The server could not complete your request right now.'
        : `Request failed with status ${response.status}`;

    throw createApiError(payload?.error || fallbackMessage, response.status, requestId);
  }

  return payload?.data ?? null;
}

export async function uploadRequest(path, file) {
  if (!file) {
    throw createApiError('Choose a file to upload.', 400);
  }

  const formData = new FormData();
  formData.append('image', file);

  let response;
  try {
    response = await fetch(`${apiBaseUrl}/api${path}`, {
      method: 'POST',
      headers: currentCsrfToken ? { 'X-CSRF-Token': currentCsrfToken } : {},
      credentials: 'include',
      body: formData,
    });
  } catch {
    throw createApiError('Unable to reach the server. Please check your connection and try again.', 0);
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;
  const requestId = payload?.requestId || response.headers.get('x-request-id');
  syncSecurityState(payload?.data);

  if (!response.ok) {
    if (response.status === 401) {
      clearCsrfToken();
      dispatchAuthEvent('expired', { path });
    }

    throw createApiError(
      payload?.error || 'Unable to upload the file right now.',
      response.status,
      requestId
    );
  }

  return payload?.data ?? null;
}
