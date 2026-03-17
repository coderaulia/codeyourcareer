# Deployment Checklist

## API deployment

1. Upload the latest API source or pull the latest repository commit.
2. Run `npm install`.
3. Apply schema updates in:
   - `database/mysql-schema.sql`
   - `database/mysql-upgrade-2026-03.sql`
4. Configure API environment variables from `docs/env-production.md`.
5. Ensure `UPLOAD_DIR` exists and is writable by the Node.js app.
6. Start the app with `npm start`.
7. Verify:
   - `https://api.codeyourcareer.my.id/api/health`
   - `https://api.codeyourcareer.my.id/api/version`
   - admin login works
   - image upload returns a public `/uploads/...` URL
   - `POST /api/analytics/session` and `POST /api/analytics/events` succeed from the frontend origin

## Frontend deployment

1. Set `VITE_API_BASE_URL=https://api.codeyourcareer.my.id`.
2. Run `npm run build`.
3. Deploy the generated frontend build.
4. Verify:
   - homepage modules load from the API
   - `/adminpanel` login works
   - internal links, uploads, ordering, booking updates, and message read/unread all work
   - analytics module shows visits, sources, and conversions after a test visit with UTM params

## Post-deploy checks

1. Sign in on two admin tabs.
2. Log out in one tab and confirm the other tab is forced out on the next sync/API action.
3. Attempt repeated bad logins and confirm rate limiting returns `429`.
4. Confirm admin writes fail without a CSRF token.
5. Confirm public pages render uploaded testimonial/resource/logo images.
6. Run:
   - `npm run seed:demo` only on non-production data
   - `npm run seed:admin` only when bootstrapping admin access
