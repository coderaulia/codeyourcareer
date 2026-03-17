# Production Environment Reference

## Frontend build deployment

Use this on the frontend deployment that serves `codeyourcareer.my.id`.

```env
VITE_API_BASE_URL=https://api.codeyourcareer.my.id
```

Notes:
- Leave `VITE_API_BASE_URL` empty only when frontend and API are served from the same origin.
- Frontend builds do not need MySQL credentials.

## API deployment

Use this on the API deployment that serves `api.codeyourcareer.my.id`.

```env
PORT=3000
NODE_ENV=production
SESSION_SECRET=replace-with-a-long-random-secret
SESSION_COOKIE_SECURE=true
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=your_database
MYSQL_USER=your_database_user
MYSQL_PASSWORD=your_database_password
MYSQL_CONNECTION_LIMIT=10
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-this-after-first-login
CORS_ALLOWED_ORIGINS=https://codeyourcareer.my.id
DEPLOY_MARKER=production-api
UPLOAD_DIR=/home/your-user/uploads
MAX_UPLOAD_MB=5
LOGIN_RATE_LIMIT_WINDOW_MS=900000
LOGIN_RATE_LIMIT_MAX_ATTEMPTS=5
```

Notes:
- `MYSQL_HOST=127.0.0.1` avoids the IPv6 `::1` auth issue seen on Hostinger.
- `SESSION_COOKIE_SECURE=true` keeps the admin cookie HTTPS-only in production. Leave it as `auto` or `false` only for local HTTP development.
- `CORS_ALLOWED_ORIGINS` should list the frontend origins allowed to use authenticated admin APIs.
- `UPLOAD_DIR` should point to a writable folder that persists for the API app.
- Rotate `SESSION_SECRET`, `MYSQL_PASSWORD`, and `ADMIN_PASSWORD` after deployment.

## Local development

```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=local-dev-secret
SESSION_COOKIE_SECURE=auto
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=codeyourcareer
MYSQL_USER=root
MYSQL_PASSWORD=local-password
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=local-admin-password
VITE_API_BASE_URL=http://localhost:3000
CORS_ALLOWED_ORIGINS=http://localhost:5173
UPLOAD_DIR=storage/uploads
MAX_UPLOAD_MB=5
LOGIN_RATE_LIMIT_WINDOW_MS=900000
LOGIN_RATE_LIMIT_MAX_ATTEMPTS=5
```

## Database upgrade

Apply both files when provisioning or upgrading MySQL:
- `database/mysql-schema.sql`
- `database/mysql-upgrade-2026-03.sql`
