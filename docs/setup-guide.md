# Setup Guide

## Quick Start

### 1. Run the Installer

```bash
node scripts/install.js
```

The wizard will:
- Test your MySQL connection
- Create the database if needed
- Run schema migrations
- Create your admin account
- Optionally add sample content
- Generate a `.env` configuration file

### 2. Start the Server

```bash
npm run dev:api
```

### 3. Access Your Site

- **Public site**: http://localhost:5173
- **Admin panel**: http://localhost:5173/adminpanel

---

## First-Time Setup Wizard

When you first log in to the admin panel, a setup wizard will guide you through:

1. **Site Details** - Set your site name and headline
2. **Quick Links** - Add your first homepage links
3. **Features** - Enable the modules you want

You can skip any step and configure everything later from the admin panel.

---

## Sample Data

### Minimal Sample

For a quick start with just essential content:

```bash
npm run seed:sample
```

This adds:
- 3 homepage links (Book a Session, Free Resources, Contact)
- Consultation module enabled

### Full Demo

For a complete demo with testimonials and resources:

```bash
npm run seed:demo
```

This adds sample testimonials, freebies, and gear recommendations.

---

## Admin Panel Overview

### Tabs

| Tab | Purpose |
|-----|---------|
| Dashboard | Quick stats and overview |
| Appearance | Site name, logo, colors, CTA |
| Links | Homepage link cards |
| Content | Resources, bookings, testimonials |
| Modules | Enable/disable features |
| Maintenance | Backup, restore, cleanup |

### Modules

| Module | Description |
|--------|-------------|
| Consultation | Booking form for 1:1 sessions |
| Testimonials | Client testimonials section |
| Contact | Contact form for inquiries |
| Analytics | Traffic tracking and reports |

---

## Customization

### Theme Colors

In **Appearance > Theme Colors**, customize:
- Background, text, accent colors
- Card backgrounds and borders
- CTA section colors

### Logo

Choose from three logo types:
- **SVG Code** - Paste inline SVG markup
- **Image URL** - Link to an external image
- **Emoji** - Simple emoji character

### Homepage Links

Create links that appear on your public homepage:

**External Links**:
- Full URL (e.g., `https://example.com/resource`)
- Opens in new tab

**Internal Links**:
- Use `#section` format (e.g., `#consultation`, `#freebies`)
- Navigates within your site without page reload

---

## Common Tasks

### Add a Resource (Freebie or Gear)

1. Go to **Content** tab
2. Fill in the form:
   - Title, description/category, URL, image
   - Select table: Freebies or Gear
3. Click **Save to Database**

### View Bookings

1. Go to **Content** tab
2. Scroll to Bookings section
3. Actions available:
   - **Confirm** - Add a meeting link
   - **Complete/No Show** - Mark outcome
   - **Delete** - Remove booking

### Enable Testimonials

1. Go to **Modules** tab
2. Toggle **Testimonials** to ON
3. Add testimonials in the new Testimonials section

---

## Troubleshooting

### Database Connection Issues

If the installer can't connect to MySQL:

1. Ensure MySQL is running
2. Check credentials in `.env`
3. Verify the user has access to create databases

### CORS Errors

If you see CORS errors in the browser console:

1. Check `CORS_ALLOWED_ORIGINS` in `.env`
2. For local dev: `http://localhost:5173`
3. For production: your frontend domain

### Uploads Not Working

1. Ensure `UPLOAD_DIR` exists and is writable
2. Check disk space on the server
3. Verify `MAX_UPLOAD_MB` is sufficient

---

## Environment Variables

See [`.env.example`](../.env.example) for all configuration options.

Key variables:

| Variable | Description |
|----------|-------------|
| `SESSION_SECRET` | Cookie signing secret (generate a long random string) |
| `MYSQL_*` | Database connection settings |
| `ADMIN_EMAIL` | Initial admin account email |
| `ADMIN_PASSWORD` | Initial admin password |
| `CORS_ALLOWED_ORIGINS` | Frontend URL(s) for admin API access |
| `DATA_RETENTION_DAYS` | Days to keep analytics data (default: 90) |
