# Agent Guidelines for CodeYourCareer

## Project Overview

This is a full-stack JavaScript application using Vite (frontend build) and Express.js (backend API). The project uses ES modules throughout and targets both a public marketing site and an admin panel.

## Build, Lint, and Test Commands

```bash
# Development
npm run dev          # Start Vite dev server (frontend on :5173)
npm run dev:api      # Start Express API server with file watching (port 3000)
npm run dev:full     # Run both dev servers concurrently

# Build
npm run build        # Production build to dist/
npm run build:analyze # Build with bundle analysis (opens reports/)

# Production
npm start            # Run Express API server (dist must exist)

# Testing
npm test             # Run API tests (node tests/api.test.js)
npm run check        # Run build + tests

# Database seeding
npm run seed:admin   # Create admin user from env vars
npm run seed:demo    # Seed demo content (full sample data)
npm run seed:sample  # Seed minimal sample data

# Setup
npm run setup        # Interactive installer wizard (node scripts/install.js)

# Maintenance
npm run cleanup     # Run data retention cleanup (node server/scripts/cleanup-data.js)
```

### Running a Single Test

The test runner uses top-level `await` with a custom `runTest` function. To run a specific test, you can use node's `--test-name-pattern` flag or modify the test file temporarily:

```bash
node --eval "
import assert from 'node:assert/strict';
// ... paste test code and call runTest directly
"
```

## Code Style Guidelines

### General Conventions

- **Indentation**: 2 spaces (no tabs)
- **Line endings**: LF (enforced by git)
- **Max line length**: ~100 characters (soft guideline)
- **Quotes**: Single quotes for strings in JS; double quotes in HTML/templates

### File Naming

- Use **kebab-case** for all file names: `admin-user.js`, `public-routes.js`
- Feature-based organization under `src/features/`, `src/api/`, `src/shared/`
- Server routes organized under `server/routes/`

### Imports and Exports

- Use ES modules (`import`/`export`) throughout - no CommonJS
- Use `node:` prefix for Node.js built-in modules:
  ```js
  import { existsSync } from 'node:fs';
  import http from 'node:http';
  ```
- Order imports: external packages → internal modules → relative imports
- Use **named exports** primarily; default exports only when appropriate (e.g., `createApiRouter`)

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Variables/functions | camelCase | `createBooking`, `analyticsState` |
| Constants | UPPER_SNAKE_CASE | `MAX_UPLOAD_MB`, `WRITE_METHODS` |
| Classes | PascalCase | (rarely used in this codebase) |
| CSS classes | kebab-case | `app-toast`, `panel-feedback` |
| Database columns | snake_case | `session_id`, `source_label` |
| API response keys | camelCase | `sessionId`, `analyticsEnabled` |

### Async/Asynchronous Code

- Use `async`/`await` consistently - avoid `.then()/.catch()` chains for readability
- Always handle errors in async functions with `try/catch` or `.catch()`
- Use `void` prefix for intentionally unawaited async calls in event handlers:
  ```js
  element.addEventListener('click', () => {
    void trackSectionView(target);
  });
  ```

### Error Handling

- Use the `createHttpError(statusCode, publicMessage, options)` helper from `logger.js` for API errors
- All API errors return `{ error: "message", requestId: "..." }` format
- Never expose internal error details to clients; use `publicMessage` for user-facing text
- Always attach `requestId` to error responses for tracing:
  ```js
  response.status(503).json({
    error: 'Database connection unavailable.',
    requestId: request.requestId,
  });
  ```

### Response Format

- Success: `{ data: <payload> }` - always wrap in `data` key
- Errors: `{ error: "message", requestId: "..." }`
- HTTP status codes: 200 (success), 201 (created), 204 (no content), 4xx (client error), 5xx (server error)

### Security

- CSRF tokens required for all state-changing operations (POST, PUT, PATCH, DELETE)
- Origin validation via `ensureTrustedOrigin()` for admin routes
- Rate limiting on login endpoints (5 attempts per 15 minutes by default)
- Use `createHttpError(403, ...)` for security violations
- Never log sensitive data (passwords, tokens) - only IDs and metadata

### Database Queries

- Use parameterized queries exclusively - no string interpolation
- Column names use `snake_case` in SQL; mapping to `camelCase` in JavaScript
- Always provide a `transaction` wrapper for multi-statement operations

### TypeScript

This is a **JavaScript project** - there is no TypeScript configuration. Avoid adding `.ts` files or TypeScript syntax.

### Additional Guidelines

- **No comments**: The codebase generally avoids comments; write self-documenting code
- **No `any`**: Avoid using `any` type (though this is JS, avoid implicit `any` patterns)
- **Consistent null checks**: Use `??` and `?.` operators; avoid truthiness checks for null/undefined
- **Security headers**: Set in `server/app.js` - X-Content-Type-Options, X-Frame-Options, Referrer-Policy, etc.
- **Request IDs**: Every API request gets a `requestId` via `attachRequestContext` middleware
- **Structured logging**: Use `logInfo`, `logWarn`, `logError` from `logger.js` with consistent event names

## Architecture Notes

### Frontend (src/)

- `src/main.js` - Public site entry
- `src/admin-main.js` - Admin panel entry
- `src/features/` - Feature-specific UI logic
- `src/shared/` - Shared utilities (animation, analytics, utils)
- `src/api/` - API client functions

### Backend (server/)

- `server/index.js` - Express server entry point
- `server/app.js` - App factory with middleware setup
- `server/routes/` - Route handlers (api.js, auth-routes.js, admin-*.js, public-routes.js)
- `server/db.js` - Database connection helpers
- `server/security.js` - CSRF, CORS, rate limiting utilities
- `server/logger.js` - Logging and error helpers

### Admin Routes

All `/api/admin/*` routes require:
1. Valid session cookie
2. CSRF token in `X-CSRF-Token` header (for write methods)
3. Trusted origin validation (for write methods)

### Maintenance Routes

Backup/restore and data cleanup endpoints under `/api/admin/maintenance/*`:
- `GET /admin/maintenance/backup` - List available backups
- `POST /admin/maintenance/backup` - Create new backup (rate limited)
- `GET /admin/maintenance/backup/:filename` - Download backup
- `DELETE /admin/maintenance/backup/:filename` - Delete backup
- `POST /admin/maintenance/backup/restore` - Restore from backup
- `POST /admin/maintenance/cleanup` - Run data retention cleanup

### API Testing

Tests in `tests/api.test.js` use:
- Node's built-in `assert` module
- Custom `startServer()` harness with in-memory mock database
- Custom `createClient()` for HTTP requests with cookie jar
- Top-level `await` for async test execution

### Validation Middleware

Use `server/middleware/validate.js` for input validation:
- `validateUuid(value, fieldName)` - UUID format validation
- `validateEmail(value, fieldName)` - Email format validation
- `validateString(value, fieldName, options)` - String with length limits
- `validateOptionalString(value, fieldName)` - Nullable strings
- `validateInteger(value, fieldName, options)` - Integer with min/max bounds
- `validateBoolean(value, fieldName)` - Boolean coercion
- `validateEnum(value, fieldName, allowedValues)` - Allowlist validation
- `validateUrl(value, fieldName)` - URL validation
- `sanitizeHtml(value)` - XSS prevention

## Deployment Rules

### API Backend Updates

When backend files change, update the deploy zip:

1. Copy changed files to `deploy/api-subdomain/`:
   - `server/routes/*.js` → `deploy/api-subdomain/server/routes/`
   - `server/middleware/*.js` → `deploy/api-subdomain/server/middleware/`
   - `server/scripts/*.js` → `deploy/api-subdomain/server/scripts/`
   - `scripts/*.js` → `deploy/api-subdomain/scripts/`

2. Update `.env.example` in `deploy/api-subdomain/` when env vars change

3. Regenerate the zip:
   ```bash
   cd deploy
   rm -f codeyourcareer-api-subdomain-flat.zip
   powershell -Command "Compress-Archive -Path 'api-subdomain' -DestinationPath 'codeyourcareer-api-subdomain-flat.zip'"
   ```

4. Notify user to download and re-upload the new zip

### Environment Variable Changes

When `.env.example` changes:
- Always notify user to update their `.env` on Hostinger
- List which new variables need to be added
- Provide default values if applicable

### Files That Require User Action

| Change | User Action Required |
|--------|---------------------|
| `server/routes/*.js` | Re-upload API zip |
| `server/middleware/*.js` | Re-upload API zip |
| `server/scripts/*.js` | Re-upload API zip |
| `scripts/*.js` | Re-upload API zip |
| `.env.example` changes | Update `.env` on Hostinger |
| `database/mysql-schema.sql` | Run manual SQL migration if needed |
