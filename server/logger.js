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
