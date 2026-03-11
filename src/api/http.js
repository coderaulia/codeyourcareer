const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
const apiBaseUrl = configuredApiBaseUrl.endsWith('/api')
  ? configuredApiBaseUrl.slice(0, -4)
  : configuredApiBaseUrl;

export async function apiRequest(path, options = {}) {
  const { body, headers = {}, method = 'GET', signal } = options;
  const response = await fetch(`${apiBaseUrl}/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }

  return payload?.data ?? null;
}
