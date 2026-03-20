# CodeYourCareer

A self-hosted career consulting website with booking system, contact forms, testimonials, and traffic analytics. Built for career coaches and consultants who want a simple, powerful presence online.

## Features

- **Public Site** - Customizable homepage with links, testimonials, booking form, and contact form
- **Admin Panel** - Full content management without touching code
- **Booking System** - Let clients book consultation sessions directly
- **Contact Form** - Simple inquiry forms with inbox
- **Testimonials** - Display client social proof
- **Traffic Analytics** - First-party analytics without third-party scripts
- **Theme Customization** - Colors, logo, and branding options

## Requirements

- Node.js 18+
- MySQL 5.7+ or MariaDB 10.3+
- npm 9+

## Quick Start

### 1. Clone or Download

```bash
git clone <repository-url>
cd codeyourcareer
```

### 2. Run the Installer

```bash
node scripts/install.js
```

The wizard will:
- Connect to your MySQL database
- Create the database and tables
- Create your admin account
- Generate configuration

### 3. Start the Server

```bash
npm run dev:api
```

### 4. Access Your Sites

- **Public site**: http://localhost:5173
- **Admin panel**: http://localhost:5173/adminpanel

## Installation Steps Explained

### Step 1: Database Setup

The installer will ask for:
- MySQL host (default: localhost)
- MySQL port (default: 3306)
- Database name (default: codeyourcareer)
- MySQL username and password

It will automatically create the database and run all migrations.

### Step 2: Admin Account

Create your admin login:
- Email address for login
- Password (minimum 10 characters)

### Step 3: Sample Content

Choose whether to add sample content:
- 3 homepage links
- Consultation module enabled

You can skip this and add content manually later.

### Step 4: Configuration

The installer creates a `.env` file with all settings:

```env
PORT=3000
SESSION_SECRET=generated-random-secret
MYSQL_HOST=localhost
MYSQL_DATABASE=codeyourcareer
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-password
```

## Production Deployment

### Build the Frontend

```bash
npm run build
```

This creates the `dist/` folder with all static assets.

### Configure Environment

For production, set these environment variables:

```env
NODE_ENV=production
PORT=3000
SESSION_SECRET=a-long-random-secret-minimum-32-chars
SESSION_COOKIE_SECURE=true
MYSQL_HOST=your-mysql-host
MYSQL_PORT=3306
MYSQL_DATABASE=your_database
MYSQL_USER=your_user
MYSQL_PASSWORD=your_password
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=your-secure-password
CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

### Start the Server

```bash
npm start
```

### Frontend Deployment

Build the frontend with your API URL:

```bash
VITE_API_BASE_URL=https://api.yourdomain.com npm run build
```

Deploy the `dist/` folder to any static hosting (Netlify, Vercel, Cloudflare Pages, etc.)

## Admin Panel Guide

### Dashboard

Overview of your site with quick stats:
- Active links count
- Pending bookings
- Unread messages
- Tracked clicks

### Appearance

Customize your site's look:
- **Site Name** - Your brand/site name
- **Headline** - Main value proposition
- **Logo** - SVG code, image URL, or emoji
- **Colors** - Background, text, accent, cards, CTA buttons

### Links

Create homepage link cards:
- **External Links** - Full URL to external pages
- **Internal Links** - Use `#section` format for in-site navigation

### Content

Manage your resources:
- **Freebies** - Free resources/templates
- **Gear** - Product recommendations
- **Bookings** - View and manage consultation requests
- **Testimonials** - Client quotes and reviews

### Modules

Toggle site features:
| Module | What It Does |
|--------|--------------|
| Consultation | Booking form for 1:1 sessions |
| Testimonials | Client testimonials section |
| Contact | Contact inquiry form |
| Analytics | Traffic tracking and reports |

### Maintenance

Database management:
- **Create Backup** - Download SQL dump
- **Restore Backup** - Upload backup file
- **Data Cleanup** - Remove old analytics data

## API Reference

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/site-settings` | Site configuration |
| GET | `/api/links/active` | Homepage links |
| GET | `/api/modules` | Enabled modules |
| POST | `/api/bookings` | Submit booking |
| POST | `/api/contact-messages` | Submit contact |
| POST | `/api/analytics/session` | Track visitor |
| POST | `/api/analytics/events` | Track events |

### Admin Endpoints

All admin endpoints require authentication and CSRF token.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard-stats` | Quick stats |
| PUT | `/api/admin/site-settings` | Update settings |
| GET/POST/PUT/DELETE | `/api/admin/links` | Manage links |
| GET/POST/PUT/DELETE | `/api/admin/resources/:table` | Manage content |
| GET | `/api/admin/bookings` | List bookings |
| PUT | `/api/admin/bookings/:id/status` | Update status |
| GET/POST/PUT/DELETE | `/api/admin/testimonials` | Manage testimonials |
| GET | `/api/admin/analytics/overview` | Traffic report |
| GET | `/api/admin/analytics/export.csv` | Download CSV |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `SESSION_SECRET` | (required) | Cookie signing secret |
| `MYSQL_HOST` | localhost | Database host |
| `MYSQL_PORT` | 3306 | Database port |
| `MYSQL_DATABASE` | (required) | Database name |
| `MYSQL_USER` | (required) | Database user |
| `MYSQL_PASSWORD` | (required) | Database password |
| `CORS_ALLOWED_ORIGINS` | - | Frontend URL(s) |
| `DATA_RETENTION_DAYS` | 90 | Analytics retention |
| `BACKUP_DIR` | storage/backups | Backup storage |
| `MAX_UPLOAD_MB` | 5 | Max file upload size |

## File Structure

```
├── server/              # Express API
│   ├── routes/         # API endpoints
│   ├── scripts/        # CLI tools
│   └── middleware/     # Validation
├── src/                # Frontend source
│   ├── features/       # UI components
│   ├── api/            # API client
│   └── shared/         # Utilities
├── adminpanel/         # Admin panel HTML
├── database/           # SQL schemas
├── docs/               # Documentation
└── scripts/            # Setup tools
```

## Common Tasks

### Add a Resource

1. Go to **Content** tab
2. Select table (Freebies or Gear)
3. Fill title, URL, description
4. Optionally upload an image
5. Save

### Process a Booking

1. Go to **Content** > Bookings
2. Click **Confirm** to add meeting link
3. After the call, mark **Complete** or **No Show**

### Enable Testimonials

1. Go to **Modules** tab
2. Toggle Testimonials to ON
3. Go to **Content** section
4. Add testimonials with name, quote, rating

### Change Colors

1. Go to **Appearance** > Theme Colors
2. Pick colors using the color pickers
3. Changes apply immediately to the public site

## Troubleshooting

### Database Connection Failed

1. Verify MySQL is running
2. Check credentials in `.env`
3. Ensure the user has database access

### CORS Errors

Set `CORS_ALLOWED_ORIGINS` to your frontend URL:
```
CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

### Images Not Uploading

1. Ensure `storage/uploads/` exists
2. Check disk space
3. Verify upload directory is writable

### Analytics Not Tracking

Enable the Analytics module in **Modules** tab.

## Updating

Pull the latest code and run:

```bash
git pull
npm install
npm run build
npm start
```

## Security Recommendations

1. **Use strong SESSION_SECRET** - Minimum 32 random characters
2. **Enable HTTPS** - Set `SESSION_COOKIE_SECURE=true`
3. **Regular backups** - Use the Maintenance tab
4. **Strong admin password** - Use 16+ characters
5. **Limit login attempts** - Default: 5 per 15 minutes

## License

MIT License - See LICENSE file for details.
