import 'dotenv/config';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieSession from 'cookie-session';
import express from 'express';
import { ensureAdminUser } from './admin-user.js';
import { pingDatabase, one, query, transaction } from './db.js';
import { attachRequestContext, getDeployInfo, logError, logInfo } from './logger.js';
import { createApiRouter } from './routes/api.js';
import { ensureUploadDir } from './uploads.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const defaultDistDir = path.join(rootDir, 'dist');
const defaultUploadDir = path.join(rootDir, 'storage', 'uploads');

function parseOptionalBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalizedValue = String(value || '').trim().toLowerCase();
  if (!normalizedValue || normalizedValue === 'auto') {
    return undefined;
  }

  if (normalizedValue === 'true') {
    return true;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  return undefined;
}

export function buildServerConfig(overrides = {}) {
  const distDir = overrides.distDir || defaultDistDir;
  const allowedOrigins =
    overrides.allowedOrigins ||
    new Set(
      (process.env.CORS_ALLOWED_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    );

  return {
    rootDir,
    distDir,
    distExists: overrides.distExists ?? existsSync(distDir),
    port: Number(overrides.port ?? process.env.PORT ?? 3000),
    sessionSecret: overrides.sessionSecret ?? process.env.SESSION_SECRET,
    allowedOrigins,
    hasCrossOriginFrontend: allowedOrigins.size > 0,
    uploadDir: overrides.uploadDir || process.env.UPLOAD_DIR || defaultUploadDir,
    maxUploadMb: Number(overrides.maxUploadMb ?? process.env.MAX_UPLOAD_MB ?? 5),
    sessionCookieSecure: parseOptionalBoolean(
      overrides.sessionCookieSecure ?? process.env.SESSION_COOKIE_SECURE
    ),
    loginRateLimitWindowMs: Number(
      overrides.loginRateLimitWindowMs ?? process.env.LOGIN_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000
    ),
    loginRateLimitMaxAttempts: Number(
      overrides.loginRateLimitMaxAttempts ?? process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS ?? 5
    ),
    pingDatabase: overrides.pingDatabase || pingDatabase,
    one: overrides.one || one,
    query: overrides.query || query,
    transaction: overrides.transaction || transaction,
    ensureAdminUser: overrides.ensureAdminUser || ensureAdminUser,
    apiRouterFactory: overrides.apiRouterFactory || createApiRouter,
    adminEmail: overrides.adminEmail ?? process.env.ADMIN_EMAIL,
    adminPassword: overrides.adminPassword ?? process.env.ADMIN_PASSWORD,
    ...overrides,
  };
}

export function createApp(overrides = {}) {
  const config = buildServerConfig(overrides);
  if (!config.sessionSecret) {
    throw new Error('Missing SESSION_SECRET environment variable.');
  }

  ensureUploadDir(config.uploadDir);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(attachRequestContext);
  app.locals.serverConfig = config;

  app.use((request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    const origin = request.headers.origin;
    if (origin && config.allowedOrigins.has(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Allow-Credentials', 'true');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-Id, X-CSRF-Token');
      response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      response.append('Vary', 'Origin');
    }

    if (request.method === 'OPTIONS') {
      response.sendStatus(204);
      return;
    }

    next();
  });

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));
  const sessionOptions = {
    name: 'cyc_admin_session',
    keys: [config.sessionSecret],
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  };
  if (typeof config.sessionCookieSecure === 'boolean') {
    sessionOptions.secure = config.sessionCookieSecure;
  }
  app.use(cookieSession(sessionOptions));

  app.use('/uploads', express.static(config.uploadDir, { fallthrough: true, index: false }));

  app.get('/api/health', async (request, response) => {
    try {
      const database = await config.pingDatabase();
      response.status(database ? 200 : 503).json({
        data: {
          ok: database,
          database,
          ...getDeployInfo(),
        },
      });
    } catch (error) {
      logError('health_check_failed', error, {
        requestId: request.requestId,
        path: request.originalUrl,
      });

      response.status(503).json({
        data: {
          ok: false,
          database: false,
          ...getDeployInfo(),
        },
        error: 'Database connection unavailable.',
        requestId: request.requestId,
      });
    }
  });

  app.use('/api', config.apiRouterFactory(config));

  if (config.distExists) {
    app.use(express.static(config.distDir, { index: false }));

    app.get('/adminpanel', (_request, response) => {
      response.sendFile(path.join(config.distDir, 'adminpanel', 'index.html'));
    });

    app.get('/adminpanel/*', (_request, response) => {
      response.sendFile(path.join(config.distDir, 'adminpanel', 'index.html'));
    });

    app.get('*', (_request, response) => {
      response.sendFile(path.join(config.distDir, 'index.html'));
    });
  } else {
    app.get('/', (_request, response) => {
      response.json({
        data: {
          ok: true,
          service: 'codeyourcareer-api',
          ...getDeployInfo(),
        },
      });
    });

    app.use((_request, response) => {
      response.status(404).json({ error: 'Route not found.' });
    });
  }

  app.use((error, request, response, _next) => {
    const statusCode = Number(error?.statusCode) || 500;
    const publicMessage =
      statusCode >= 500
        ? 'Something went wrong on the server. Please try again in a moment.'
        : error?.publicMessage || error?.message || 'Request failed.';

    logError('request_failed', error, {
      requestId: request.requestId,
      method: request.method,
      path: request.originalUrl,
      statusCode,
    });

    if (error?.retryAfterSeconds) {
      response.setHeader('Retry-After', String(error.retryAfterSeconds));
    }

    response.status(statusCode).json({
      error: publicMessage,
      requestId: request.requestId,
    });
  });

  return { app, config };
}

export async function bootstrapAdminFromEnv(config = buildServerConfig()) {
  if (!config.adminEmail || !config.adminPassword) {
    return null;
  }

  const result = await config.ensureAdminUser(config.adminEmail, config.adminPassword);
  logInfo('admin_bootstrap_completed', result);
  return result;
}
