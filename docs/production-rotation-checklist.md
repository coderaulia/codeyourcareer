# Production Rotation Checklist

Use this after any credential exposure or before a major production push.

## 1. Rotate the MySQL password

- Generate a new strong password in Hostinger.
- Update the MySQL user password in hPanel.
- Update `MYSQL_PASSWORD` in every API deployment that uses it.
- Redeploy the API app.
- Re-check `https://api.codeyourcareer.my.id/api/health`.

## 2. Rotate the admin password

Recommended path:

- Sign in to `/adminpanel`.
- Use the Security card to change the admin password.
- Update `ADMIN_PASSWORD` in Hostinger so future `npm run seed:admin` calls stay aligned.

Fallback path:

```bash
npm run seed:admin
```

with the new `ADMIN_PASSWORD` value set in the environment.

## 3. Rotate the session secret

Generate a new random secret and update `SESSION_SECRET` in Hostinger. Example:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Then redeploy the API app so the new secret takes effect.

## 4. Verify after rotation

- `https://api.codeyourcareer.my.id/api/health`
- `https://api.codeyourcareer.my.id/api/version`
- Admin login on `/adminpanel`
- Booking and contact form submissions
