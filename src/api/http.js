const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
const apiBaseUrl = configuredApiBaseUrl.endsWith('/api')
  ? configuredApiBaseUrl.slice(0, -4)
  : configuredApiBaseUrl;

function createApiError(message, statusCode, requestId) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.requestId = requestId || null;
  return error;
}

export async function apiRequest(path, options = {}) {
  const { body, headers = {}, method = 'GET', signal } = options;

  let response;
  try {
    response = await fetch(`${apiBaseUrl}/api${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch {
    throw createApiError('Unable to reach the server. Please check your connection and try again.', 0);
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;
  const requestId = payload?.requestId || response.headers.get('x-request-id');

  if (!response.ok) {
    const fallbackMessage = response.status >= 500
      ? 'The server could not complete your request right now.'
      : `Request failed with status ${response.status}`;

    throw createApiError(payload?.error || fallbackMessage, response.status, requestId);
  }

  return payload?.data ?? null;
}
