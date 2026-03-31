import { randomUUID } from 'node:crypto';
import { createHttpError } from './logger.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function getClientIp(request) {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return request.ip || request.socket?.remoteAddress || 'unknown';
}

export function isWriteMethod(method) {
  return WRITE_METHODS.has(String(method || '').toUpperCase());
}

export function ensureTrustedOrigin(request, allowedOrigins = new Set()) {
  const origin = String(request.headers.origin || '').trim();
  if (!origin) {
    return;
  }

  const requestOrigin = `${request.protocol}://${request.get('host')}`;
  if (origin === requestOrigin || allowedOrigins.has(origin)) {
    return;
  }

  throw createHttpError(403, 'Request origin not allowed.');
}

export function issueCsrfToken(request) {
  const token = randomUUID();
  if (request.session) {
    request.session.csrfToken = token;
  }

  return token;
}

export function getCsrfToken(request) {
  const existingToken = request.session?.csrfToken;
  if (existingToken) {
    return existingToken;
  }

  return issueCsrfToken(request);
}

export function verifyCsrfToken(request) {
  const expectedToken = request.session?.csrfToken;
  const providedToken = String(request.headers['x-csrf-token'] || '').trim();

  if (!expectedToken || !providedToken || providedToken !== expectedToken) {
    throw createHttpError(403, 'Security token missing or expired. Refresh the page and try again.');
  }
}

export function createLoginRateLimiter({ maxAttempts = 5, windowMs = 15 * 60 * 1000 } = {}) {
  const attempts = new Map();

  function prune(now) {
    attempts.forEach((entry, key) => {
      if (entry.resetAt <= now) {
        attempts.delete(key);
      }
    });
  }

  function buildKey(request, email) {
    return `${getClientIp(request)}:${String(email || '').trim().toLowerCase() || 'unknown'}`;
  }

  return {
    check(request, email) {
      const now = Date.now();
      prune(now);

      const entry = attempts.get(buildKey(request, email));
      if (!entry || entry.resetAt <= now || entry.count < maxAttempts) {
        return;
      }

      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      const error = createHttpError(
        429,
        `Too many login attempts. Try again in ${retryAfterSeconds} seconds.`
      );
      error.retryAfterSeconds = retryAfterSeconds;
      throw error;
    },

    record(request, email, success) {
      const key = buildKey(request, email);
      if (success) {
        attempts.delete(key);
        return;
      }

      const now = Date.now();
      const existing = attempts.get(key);
      if (!existing || existing.resetAt <= now) {
        attempts.set(key, {
          count: 1,
          resetAt: now + windowMs,
        });
        return;
      }

      attempts.set(key, {
        count: existing.count + 1,
        resetAt: existing.resetAt,
      });
    },
  };
}

export function createPublicRateLimiter({ maxAttempts = 10, windowMs = 60 * 60 * 1000 } = {}) {
  const attempts = new Map();

  function prune(now) {
    attempts.forEach((entry, key) => {
      if (entry.resetAt <= now) {
        attempts.delete(key);
      }
    });
  }

  function buildKey(request) {
    return getClientIp(request);
  }

  return {
    check(request) {
      const now = Date.now();
      prune(now);

      const key = buildKey(request);
      const entry = attempts.get(key);
      if (!entry || entry.resetAt <= now || entry.count < maxAttempts) {
        return;
      }

      const retryAfterMinutes = Math.max(1, Math.ceil((entry.resetAt - now) / 60000));
      throw createHttpError(
        429,
        `Too many requests. Please wait ${retryAfterMinutes} minute(s) before trying again.`
      );
    },

    record(request) {
      const key = buildKey(request);
      const now = Date.now();
      const existing = attempts.get(key);

      if (!existing || existing.resetAt <= now) {
        attempts.set(key, {
          count: 1,
          resetAt: now + windowMs,
        });
        return;
      }

      attempts.set(key, {
        count: existing.count + 1,
        resetAt: existing.resetAt,
      });
    },
  };
}
