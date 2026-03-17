import assert from 'node:assert/strict';
import http from 'node:http';
import bcrypt from 'bcryptjs';
import { createApp } from '../server/app.js';
import { ensureTrustedOrigin, verifyCsrfToken } from '../server/security.js';

function createClient(baseUrl) {
  const origin = 'https://admin.example.test';
  const cookieJar = new Map();

  function storeCookies(setCookieHeader) {
    const cookies = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : setCookieHeader
        ? [setCookieHeader]
        : [];

    cookies.forEach((cookie) => {
      const pair = String(cookie).split(';')[0];
      const separatorIndex = pair.indexOf('=');
      if (separatorIndex <= 0) {
        return;
      }

      const name = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      if (name) {
        cookieJar.set(name, value);
      }
    });
  }

  function buildCookieHeader() {
    return Array.from(cookieJar.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  return {
    async request(path, options = {}) {
      const url = new URL(path, baseUrl);
      const headers = {
        Origin: origin,
        ...(options.headers || {}),
      };
      const cookieHeader = buildCookieHeader();
      if (cookieHeader) {
        headers.Cookie = cookieHeader;
      }

      return new Promise((resolve, reject) => {
        const request = http.request(
          {
            method: options.method || 'GET',
            hostname: url.hostname,
            port: url.port,
            path: `${url.pathname}${url.search}`,
            headers,
          },
          (response) => {
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => {
              storeCookies(response.headers['set-cookie']);
              resolve({
                status: response.statusCode || 0,
                headers: response.headers,
                text: Buffer.concat(chunks).toString('utf8'),
                json: async () => JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'),
              });
            });
          }
        );

        request.on('error', reject);
        if (options.body) {
          request.write(options.body);
        }
        request.end();
      });
    },
  };
}

async function startServer(overrides = {}) {
  let sessionVersion = 1;
  const passwordHash = await bcrypt.hash('correct horse battery staple', 4);

  const { app } = createApp({
    distExists: false,
    sessionSecret: 'test-session-secret',
    allowedOrigins: new Set(['https://admin.example.test']),
    pingDatabase: async () => true,
    findAdminUserByEmail: async (email) =>
      email === 'admin@example.com'
        ? { id: 'admin-1', email, role: 'admin', password_hash: passwordHash, session_version: sessionVersion }
        : null,
    findAdminUserById: async (id) =>
      id === 'admin-1'
        ? { id: 'admin-1', email: 'admin@example.com', role: 'admin', session_version: sessionVersion }
        : null,
    verifyAdminPassword: async () => true,
    updatePasswordAndRotateSession: async () => {
      sessionVersion += 1;
      return sessionVersion;
    },
    rotateAdminSession: async () => {
      sessionVersion += 1;
      return sessionVersion;
    },
    query: async () => [],
    one: async () => null,
    transaction: async (callback) =>
      callback({
        query: async () => [],
        one: async () => null,
      }),
    ...overrides,
  });

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function runTest(name, callback) {
  try {
    await callback();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

await runTest('public version route returns deploy data', async () => {
  const harness = await startServer();
  const client = createClient(harness.baseUrl);

  try {
    const response = await client.request('/api/version');
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.ok(payload.data.version);
  } finally {
    await harness.close();
  }
});

await runTest('auth login returns authenticated payload and csrf token', async () => {
  const harness = await startServer();
  const client = createClient(harness.baseUrl);

  try {
    const response = await client.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'correct horse battery staple',
      }),
    });

    assert.equal(response.status, 200);
    assert.ok(response.headers['set-cookie']);
    const payload = await response.json();
    assert.equal(payload.data.authenticated, true);
    assert.equal(payload.data.user.email, 'admin@example.com');
    assert.ok(payload.data.csrfToken);

    const sessionResponse = await client.request('/api/auth/session');
    assert.equal(sessionResponse.status, 200);
    const sessionPayload = await sessionResponse.json();
    assert.equal(sessionPayload.data.authenticated, true);
    assert.equal(sessionPayload.data.user.email, 'admin@example.com');
    assert.ok(sessionPayload.data.csrfToken);
  } finally {
    await harness.close();
  }
});

await runTest('login rate limiting returns 429 after repeated failures', async () => {
  const harness = await startServer();
  const client = createClient(harness.baseUrl);

  try {
    let status = 0;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await client.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'wrong password',
        }),
      });
      status = response.status;
    }

    assert.equal(status, 429);
  } finally {
    await harness.close();
  }
});

await runTest('logout clears the current session and invalidates follow-up session checks', async () => {
  const harness = await startServer();
  const client = createClient(harness.baseUrl);

  try {
    const loginResponse = await client.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'correct horse battery staple',
      }),
    });

    const loginPayload = await loginResponse.json();
    const logoutResponse = await client.request('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': loginPayload.data.csrfToken,
      },
      body: JSON.stringify({}),
    });

    assert.equal(logoutResponse.status, 200);

    const sessionResponse = await client.request('/api/auth/session');
    assert.equal(sessionResponse.status, 200);
    const sessionPayload = await sessionResponse.json();
    assert.equal(sessionPayload.data.authenticated, false);
  } finally {
    await harness.close();
  }
});

await runTest('csrf helper rejects missing token and accepts matching token', async () => {
  const request = {
    headers: {},
    session: { csrfToken: 'token-123' },
  };

  assert.throws(() => verifyCsrfToken(request), /Security token missing or expired/);

  request.headers['x-csrf-token'] = 'token-123';
  assert.doesNotThrow(() => verifyCsrfToken(request));
});

await runTest('origin helper allows trusted origins and rejects unknown ones', async () => {
  const trustedRequest = {
    headers: { origin: 'https://admin.example.test' },
    protocol: 'https',
    get: () => 'api.example.test',
  };
  assert.doesNotThrow(() => ensureTrustedOrigin(trustedRequest, new Set(['https://admin.example.test'])));

  const blockedRequest = {
    headers: { origin: 'https://evil.example.test' },
    protocol: 'https',
    get: () => 'api.example.test',
  };
  assert.throws(() => ensureTrustedOrigin(blockedRequest, new Set(['https://admin.example.test'])), /Request origin not allowed/);
});
