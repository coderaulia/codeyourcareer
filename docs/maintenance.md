# Maintenance Operations

## Backup and Restore

### Overview

The maintenance module provides database backup and restore functionality to protect against data loss. Backups are compressed SQL dumps stored locally on the server.

### Features

- Create full MySQL database backups
- Download existing backups
- Restore from a previous backup
- Automatic cleanup of old backups (keeps last 5 by default)
- Rate limiting (1 backup per hour by default)

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/maintenance/backup` | List all available backups |
| POST | `/api/admin/maintenance/backup` | Create a new backup |
| GET | `/api/admin/maintenance/backup/:filename` | Download a specific backup |
| DELETE | `/api/admin/maintenance/backup/:filename` | Delete a backup |
| POST | `/api/admin/maintenance/backup/restore` | Restore from a backup |

### Usage

#### List Backups

```bash
curl -X GET https://api.example.com/api/admin/maintenance/backup \
  -H "Cookie: cyc_admin_session=<session>"
```

Response:
```json
{
  "data": {
    "backups": [
      {
        "filename": "backup-2026-03-20T10-30-00.sql.gz",
        "size": 45678,
        "createdAt": "2026-03-20T10:30:00.000Z"
      }
    ]
  }
}
```

#### Create Backup

```bash
curl -X POST https://api.example.com/api/admin/maintenance/backup \
  -H "Cookie: cyc_admin_session=<session>"
```

Response:
```json
{
  "data": {
    "filename": "backup-2026-03-20T10-30-00.sql.gz",
    "size": 45678,
    "message": "Backup created successfully"
  }
}
```

#### Download Backup

Open the backup URL in browser or use curl:

```bash
curl -O https://api.example.com/api/admin/maintenance/backup/backup-2026-03-20T10-30-00.sql.gz \
  -H "Cookie: cyc_admin_session=<session>"
```

#### Restore from Backup

```bash
curl -X POST https://api.example.com/api/admin/maintenance/backup/restore \
  -H "Content-Type: application/json" \
  -H "Cookie: cyc_admin_session=<session>" \
  -d '{"filename": "backup-2026-03-20T10-30-00.sql.gz"}'
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKUP_DIR` | `storage/backups` | Directory to store backup files |
| `MAX_BACKUPS` | `5` | Maximum number of backups to retain |
| `BACKUP_RATE_LIMIT_HOURS` | `1` | Minimum hours between backup creations |

---

## Data Cleanup

### Overview

Remove old analytics data to reduce database size. This deletes:
- Visitor sessions older than the retention period
- Orphaned analytics events (no matching session)
- Link clicks older than the retention period

### API Endpoint

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/maintenance/cleanup` | Run data retention cleanup |

### Usage

```bash
curl -X POST https://api.example.com/api/admin/maintenance/cleanup \
  -H "Content-Type: application/json" \
  -H "Cookie: cyc_admin_session=<session>" \
  -d '{"retentionDays": 90}'
```

Response:
```json
{
  "data": {
    "message": "Cleanup completed. Removed 150 sessions, 23 events, 45 clicks older than 90 days.",
    "stats": {
      "sessions": 150,
      "events": 23,
      "linkClicks": 45
    }
  }
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_RETENTION_DAYS` | `90` | Default retention period in days |

### CLI Script

For command-line cleanup (e.g., via cron job):

```bash
node server/scripts/cleanup-data.js
```

---

## Security

All maintenance endpoints require:
1. Valid admin session cookie
2. CSRF token in `X-CSRF-Token` header (for write methods)
3. Trusted origin validation (for write methods)

Rate limiting applies to backup creation to prevent abuse.

---

## Recommendations

### Backup Schedule

- Run daily backups during off-peak hours
- Keep backups for at least 7 days
- Store important backups off-site weekly

### Cleanup Schedule

- Run cleanup weekly or monthly depending on traffic
- Monitor database size growth
- Adjust retention period based on analytics needs
