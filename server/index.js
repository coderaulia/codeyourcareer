import 'dotenv/config';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieSession from 'cookie-session';
import express from 'express';
import { pingDatabase } from './db.js';
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

if (!sessionSecret) {
  throw new Error('Missing SESSION_SECRET environment variable.');
}

const app = express();
app.set('trust proxy', 1);

app.use((request, response, next) => {
  const origin = request.headers.origin;

  if (origin && corsAllowedOrigins.has(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  })
);

app.get('/api/health', async (_request, response) => {
  try {
    const database = await pingDatabase();
    response.status(database ? 200 : 503).json({
      data: {
        ok: database,
        database,
      },
    });
  } catch (error) {
    response.status(503).json({
      data: {
        ok: false,
        database: false,
      },
      error: error.message,
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
      },
    });
  });

  app.use((_request, response) => {
    response.status(404).json({ error: 'Route not found.' });
  });
}

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(error.statusCode || 500).json({
    error: error.message || 'Internal server error.',
  });
});

app.listen(port, () => {
  console.log(`CodeYourCareer server listening on port ${port}`);
});
