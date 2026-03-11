# Hostinger MySQL Setup

## 1. Create the database in hPanel

- Open Hostinger hPanel.
- Create a MySQL database and user.
- Keep the database host as `localhost` unless Hostinger shows a different value in your panel.

## 2. Import the schema

- Import [database/mysql-schema.sql](../database/mysql-schema.sql) into the new MySQL database.
- This creates the public content tables, analytics tables, and the `admin_users` table.

## 3. Configure environment variables in the Node.js app

Set these variables in Hostinger Node.js hosting:

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

## 4. Install and build

Run:

```bash
npm install
npm run build
```

## 5. Create the first admin user

Run:

```bash
npm run seed:admin
```

This uses `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the environment and stores a hashed password in MySQL.

## 6. Start the app

Use:

```bash
npm start
```

The Node.js server serves both the built frontend and the `/api` routes.

## 7. Verify

- Public landing page loads.
- `/adminpanel` shows the login form.
- Admin login works with the seeded credentials.
- Bookings and contact messages are written into MySQL.
