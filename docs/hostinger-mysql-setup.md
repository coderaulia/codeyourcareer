# Hostinger MySQL Setup

## 1. Create the database in hPanel

- Open Hostinger hPanel.
- Create a MySQL database and user.
- Keep the database host as `localhost` unless Hostinger shows a different value in your panel.
- If MySQL rejects `localhost`, use `127.0.0.1` instead.

## 2. Import the schema

- Import [database/mysql-schema.sql](../database/mysql-schema.sql) into the new MySQL database.
- This creates the public content tables, analytics tables, and the `admin_users` table.

## 3. Configure environment variables

Set these variables in Hostinger:

- `PORT`
- `NODE_ENV=production`
- `SESSION_SECRET`
- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_DATABASE`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `VITE_API_BASE_URL`
- `CORS_ALLOWED_ORIGINS`
- `DEPLOY_MARKER`

Recommended values by deployment mode:

- Same-domain app: `VITE_API_BASE_URL=` and `CORS_ALLOWED_ORIGINS=`
- Separate API subdomain: `VITE_API_BASE_URL=https://api.codeyourcareer.my.id` and `CORS_ALLOWED_ORIGINS=https://codeyourcareer.my.id`
- `DEPLOY_MARKER` can be a date or git SHA such as `2026-03-11-049d66b`

Do not set `VITE_API_BASE_URL` to a value ending in `/api`.

## 4. Build and start

Frontend or full-stack app:

```bash
npm install
npm run build
npm start
```

API-only app on `api.codeyourcareer.my.id`:

```bash
npm install
npm start
```

## 5. Create or rotate the first admin user

Run:

```bash
npm run seed:admin
```

This uses `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the environment and stores a hashed password in MySQL. After the app is live, you can also rotate the admin password from `/adminpanel`.

## 6. Important Hostinger checks

- `https://your-domain/api/health` should return JSON.
- `https://your-domain/api/version` should return the app version and deploy marker.
- If `https://your-domain/api/health` returns Hostinger's default 404 HTML page, the domain is not reaching the Node.js app.
- If `https://your-domain/api/health` returns `database:false`, re-check the MySQL credentials and host value.

## 7. Post-deploy security

- Rotate `MYSQL_PASSWORD`, `ADMIN_PASSWORD`, and `SESSION_SECRET` if they were ever exposed.
- Redeploy after any environment-variable change.
- Keep only one active admin credential set in Hostinger.
