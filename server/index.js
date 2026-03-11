import 'dotenv/config';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieSession from 'cookie-session';
import express from 'express';
import { ensureAdminUser } from './admin-user.js';
import { pingDatabase } from './db.js';
import { attachRequestContext, getDeployInfo, logError, logInfo } from './logger.js';
import apiRouter from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const distExists = existsSync(distDir);
const port = Number(process.env.PORT || 3000);
const sessionSecret = process.env.SESSION_SECRET;
const corsAllowedOrigins = new Set(
  (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);
const hasCrossOriginFrontend = corsAllowedOrigins.size > 0;

if (!sessionSecret) {
  throw new Error('Missing SESSION_SECRET environment variable.');
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(attachRequestContext);

app.use((request, response, next) => {
  const origin = request.headers.origin;

  if (origin && corsAllowedOrigins.has(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-Id');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    response.append('Vary', 'Origin');
  }

  if (request.method === 'OPTIONS') {
    response.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(
  cookieSession({
    name: 'cyc_admin_session',
    keys: [sessionSecret],
    httpOnly: true,
    sameSite: hasCrossOriginFrontend ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  })
);

app.get('/api/health', async (request, response) => {
  try {
    const database = await pingDatabase();
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

app.use('/api', apiRouter);

if (distExists) {
  app.use(express.static(distDir, { index: false }));

  app.get('/adminpanel', (_request, response) => {
    response.sendFile(path.join(distDir, 'adminpanel', 'index.html'));
  });

  app.get('/adminpanel/*', (_request, response) => {
    response.sendFile(path.join(distDir, 'adminpanel', 'index.html'));
  });

  app.get('*', (_request, response) => {
    response.sendFile(path.join(distDir, 'index.html'));
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

  response.status(statusCode).json({
    error: publicMessage,
    requestId: request.requestId,
  });
});

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
if (adminEmail && adminPassword) {
  void ensureAdminUser(adminEmail, adminPassword)
    .then((result) => {
      logInfo('admin_bootstrap_completed', result);
    })
    .catch((error) => {
      logError('admin_bootstrap_failed', error);
    });
}

process.on('unhandledRejection', (error) => {
  logError('unhandled_rejection', error);
});

process.on('uncaughtException', (error) => {
  logError('uncaught_exception', error);
});

app.listen(port, () => {
  logInfo('server_started', {
    port,
    ...getDeployInfo(),
  });
});
