import 'dotenv/config';
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
const port = Number(process.env.PORT || 3000);
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error('Missing SESSION_SECRET environment variable.');
}

await pingDatabase();

const app = express();
app.set('trust proxy', 1);

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

app.get('/api/health', (_request, response) => {
  response.json({ data: { ok: true } });
});

app.use('/api', apiRouter);

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

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(error.statusCode || 500).json({
    error: error.message || 'Internal server error.',
  });
});

app.listen(port, () => {
  console.log(`CodeYourCareer server listening on port ${port}`);
});

