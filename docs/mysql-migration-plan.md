# MySQL Migration Plan for Hostinger Business Hosting

## Recommended target architecture

Use Vite only for the public and admin frontend, then add a small Node.js API on Hostinger that talks to MySQL. That keeps your frontend stack in JavaScript, removes direct browser access to the database, and gives us a clean place to move auth away from Supabase.

## Why this fits Hostinger Business Hosting

- Hostinger documents Node.js web app support on the Business Web Hosting plan.
- Hostinger also documents Vite deployment support, so the current frontend direction still fits the target host.
- Hostinger's MySQL examples use `localhost` for the database host, which is the typical shared-hosting database setup we should target first.

## Proposed stack after migration

- Frontend: Vite build output from this repo.
- Backend: Express API hosted as a Node.js web app on Hostinger.
- Database: MySQL on the Hostinger account.
- Auth: email/password stored in a MySQL `admin_users` table with hashed passwords and server-side sessions.
- File-based deployment or Git-based deployment from GitHub, depending on which Hostinger flow is smoother for the project.

## Data model to migrate

The current frontend uses these tables in Supabase:

- `site_settings`
- `modules`
- `links`
- `freebies`
- `gear`
- `bookings`
- `testimonials`
- `contact_messages`
- `link_clicks`

We also need an `admin_users` table in MySQL because Supabase Auth should be replaced instead of kept as a dependency.

## Migration phases

### Phase 1: Prepare the app

- Finish the Vite refactor so both the landing page and `/adminpanel` run from local modules.
- Move all browser-side Supabase calls behind a client API layer so the UI stops depending on Supabase-specific code.
- Keep the UI behavior the same during this phase.

### Phase 2: Design MySQL schema

- Create MySQL tables matching the current Supabase data model.
- Add missing constraints, indexes, and default timestamps.
- Add an `admin_users` table with `id`, `email`, `password_hash`, `role`, `created_at`, and `updated_at`.
- Decide which fields should be `TEXT`, `VARCHAR`, `BOOLEAN`, `DATETIME`, and `INT`.

### Phase 3: Build the backend API

- Add an Express server inside this repo or as a sibling deployment package.
- Create routes for links, modules, resources, bookings, testimonials, messages, analytics, and site settings.
- Replace Supabase auth with login, logout, session-check, and password-hash verification endpoints.
- Use `mysql2` with pooled connections.
- Protect `/adminpanel` API routes with server-side session middleware.

### Phase 4: Export and import data

- Export each Supabase table to CSV or JSON.
- Transform IDs, booleans, timestamps, and nullable fields to match MySQL.
- Import into MySQL in dependency order: settings and modules first, content next, then bookings/messages/click history.
- Create the first admin user directly in MySQL with a hashed password.

### Phase 5: Switch the frontend

- Change the frontend from direct Supabase access to calling the new API.
- Remove Supabase session checks from the admin page.
- Test every admin action and public form flow against the new backend.

### Phase 6: Cut over and clean up

- Deploy the Vite frontend and Node.js API to Hostinger.
- Point production traffic to the MySQL-backed version.
- Keep a short rollback window where the Supabase export remains untouched.
- Remove old Supabase keys and code after production verification passes.

## Suggested API surface

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/site-settings`
- `PUT /api/site-settings`
- `GET /api/modules`
- `PUT /api/modules/:slug`
- `GET /api/links`
- `POST /api/links`
- `PUT /api/links/:id`
- `DELETE /api/links/:id`
- `GET /api/freebies`
- `GET /api/gear`
- `POST /api/bookings`
- `GET /api/bookings`
- `POST /api/messages`
- `GET /api/messages`
- `GET /api/testimonials`
- `POST /api/link-clicks`
- `GET /api/analytics/links`

## Risks to account for

- Browser-side direct database access must go away before MySQL goes live.
- Supabase Auth sessions are not portable, so admin auth needs a full replacement.
- Shared hosting limits mean we should keep the API lightweight and avoid background jobs at first.
- We need a backup of the Supabase data before the first import.

## Recommended next implementation step

Build a thin API abstraction in the frontend so every page calls one shared data layer. That gives us one swap point when we replace Supabase with Express and MySQL.
