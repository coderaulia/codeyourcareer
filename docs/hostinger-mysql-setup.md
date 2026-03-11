# Hostinger MySQL Setup

## 1. Create the database in hPanel

- Open Hostinger hPanel.
- Create a MySQL database and user.
- Keep the database host as `localhost` unless Hostinger shows a different value in your panel.

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

Recommended values by deployment mode:

- Same-domain app: `VITE_API_BASE_URL=` and `CORS_ALLOWED_ORIGINS=`
- Separate API subdomain: `VITE_API_BASE_URL=https://api.codeyourcareer.my.id` and `CORS_ALLOWED_ORIGINS=https://codeyourcareer.my.id`

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

## 5. Create the first admin user

Run:

```bash
npm run seed:admin
```

This uses `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the environment and stores a hashed password in MySQL.

## 6. Important Hostinger check

If `https://your-domain/api/health` returns Hostinger's default "This Page Does Not Exist" HTML page, the domain is not reaching the Node.js app. In that case:

- make sure the domain is attached to the Node.js Web App, not only a static website deployment
- make sure the app start command is `npm start`
- if the root domain is staying on a static Vite deployment, deploy the Express server separately on `api.codeyourcareer.my.id`

## 7. Verify

- `https://your-domain/api/health` returns JSON.
- Public landing page loads.
- `/adminpanel` shows the login form.
- Admin login works with the seeded credentials.
- Bookings and contact messages are written into MySQL.
