import { randomUUID } from 'node:crypto';

const appVersion = process.env.DEPLOY_MARKER || process.env.npm_package_version || '0.2.0';
const startedAt = new Date().toISOString();

function serializeError(error) {
  if (!error) {
    return null;
  }

  return {
    message: error.message,
    stack: error.stack,
    code: error.code || null,
    statusCode: error.statusCode || null,
  };
}

function writeLog(level, event, meta = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    appVersion,
    ...meta,
  };

  const writer = level === 'error' ? console.error : console.log;
  writer(JSON.stringify(payload));
}

export function logInfo(event, meta = {}) {
  writeLog('info', event, meta);
}

export function logWarn(event, meta = {}) {
  writeLog('warn', event, meta);
}

export function logError(event, error, meta = {}) {
  writeLog('error', event, {
    ...meta,
    error: serializeError(error),
  });
}

export function createHttpError(statusCode, publicMessage, options = {}) {
  const error = new Error(options.internalMessage || publicMessage);
  error.statusCode = statusCode;
  error.publicMessage = publicMessage;
  error.code = options.code || null;
  return error;
}

export function getDeployInfo() {
  return {
    version: appVersion,
    deployMarker: process.env.DEPLOY_MARKER || null,
    environment: process.env.NODE_ENV || 'development',
    startedAt,
  };
}

export function attachRequestContext(request, response, next) {
  const requestId = request.headers['x-request-id'] || randomUUID();
  const startedAtMs = Date.now();
  request.requestId = requestId;
  response.setHeader('X-Request-Id', requestId);

  response.on('finish', () => {
    if (!request.originalUrl.startsWith('/api')) {
      return;
    }

    const durationMs = Date.now() - startedAtMs;
    const meta = {
      requestId,
      method: request.method,
      path: request.originalUrl,
      statusCode: response.statusCode,
      durationMs,
    };

    if (response.statusCode >= 500) {
      logError('api_response', null, meta);
      return;
    }

    if (response.statusCode >= 400) {
      logWarn('api_response', meta);
      return;
    }

    logInfo('api_response', meta);
  });

  next();
}

export const ACTIVITY_ACTIONS = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  PASSWORD_CHANGE: 'password_change',
  SETTINGS_UPDATE: 'settings_update',
  LINK_CREATE: 'link_create',
  LINK_UPDATE: 'link_update',
  LINK_DELETE: 'link_delete',
  RESOURCE_CREATE: 'resource_create',
  RESOURCE_UPDATE: 'resource_update',
  RESOURCE_DELETE: 'resource_delete',
  BOOKING_UPDATE: 'booking_update',
  TESTIMONIAL_CREATE: 'testimonial_create',
  TESTIMONIAL_UPDATE: 'testimonial_update',
  TESTIMONIAL_DELETE: 'testimonial_delete',
  MESSAGE_READ: 'message_read',
  MESSAGE_DELETE: 'message_delete',
  MODULE_TOGGLE: 'module_toggle',
  BACKUP_CREATE: 'backup_create',
  BACKUP_RESTORE: 'backup_restore',
  BACKUP_DELETE: 'backup_delete',
  CLEANUP_RUN: 'cleanup_run',
};

export function logActivity(options) {
  const {
    query,
    adminId,
    adminEmail,
    action,
    resourceType = null,
    resourceId = null,
    details = null,
    ipAddress = null,
    userAgent = null,
  } = options;

  if (!query) {
    logWarn('activity_log_missing_query', { action });
    return;
  }

  const id = randomUUID();
  const sql = `
    INSERT INTO activity_log (id, admin_id, admin_email, action, resource_type, resource_id, details, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    id,
    adminId || null,
    adminEmail || null,
    action,
    resourceType,
    resourceId,
    details ? JSON.stringify(details) : null,
    ipAddress,
    userAgent,
  ];

  query(sql, params).catch((error) => {
    logWarn('activity_log_failed', { action, error: error.message });
  });

  logInfo('activity_logged', { action, resourceType, resourceId, adminId });
}
