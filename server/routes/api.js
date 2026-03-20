import { Router } from 'express';
import {
  findAdminUserByEmail,
  findAdminUserById,
  normalizeEmail,
  rotateAdminSession,
  updatePasswordAndRotateSession,
  verifyAdminPassword,
} from '../admin-user.js';
import { one, query, transaction } from '../db.js';
import { createHttpError, getDeployInfo } from '../logger.js';
import {
  createLoginRateLimiter,
  ensureTrustedOrigin,
  getCsrfToken,
  issueCsrfToken,
  isWriteMethod,
  verifyCsrfToken,
} from '../security.js';
import { buildUploadUrl, createImageUploadMiddleware, runImageUpload } from '../uploads.js';
import { createAdminCoreRoutes } from './admin-core-routes.js';
import { createAdminEngagementRoutes } from './admin-engagement-routes.js';
import { createMaintenanceRoutes } from './admin-maintenance-routes.js';
import { createAuthRouter, createRequireAdmin } from './auth-routes.js';
import { createPublicRoutes } from './public-routes.js';

export function createApiRouter(config = {}) {
  const deps = {
    one: config.one || one,
    query: config.query || query,
    transaction: config.transaction || transaction,
    findAdminUserByEmail: config.findAdminUserByEmail || findAdminUserByEmail,
    findAdminUserById: config.findAdminUserById || findAdminUserById,
    normalizeEmail: config.normalizeEmail || normalizeEmail,
    verifyAdminPassword: config.verifyAdminPassword || verifyAdminPassword,
    rotateAdminSession: config.rotateAdminSession || rotateAdminSession,
    updatePasswordAndRotateSession: config.updatePasswordAndRotateSession || updatePasswordAndRotateSession,
    allowedOrigins: config.allowedOrigins || new Set(),
    loginRateLimiter:
      config.loginRateLimiter ||
      createLoginRateLimiter({
        maxAttempts: config.loginRateLimitMaxAttempts,
        windowMs: config.loginRateLimitWindowMs,
      }),
    ensureTrustedOrigin: config.ensureTrustedOrigin || ensureTrustedOrigin,
    getCsrfToken: config.getCsrfToken || getCsrfToken,
    issueCsrfToken: config.issueCsrfToken || issueCsrfToken,
    verifyCsrfToken: config.verifyCsrfToken || verifyCsrfToken,
    imageUploadMiddleware:
      config.imageUploadMiddleware ||
      createImageUploadMiddleware({
        uploadDir: config.uploadDir,
        maxUploadMb: config.maxUploadMb,
      }),
    runImageUpload: config.runImageUpload || runImageUpload,
    buildUploadUrl: config.buildUploadUrl || buildUploadUrl,
    createHttpError: config.createHttpError || createHttpError,
  };

  const router = Router();
  const adminRouter = Router();
  const requireAdmin = createRequireAdmin(deps);

  router.get('/version', (_request, response) => {
    response.json({ data: getDeployInfo() });
  });

  router.use(createPublicRoutes(deps));
  router.use('/auth', createAuthRouter(deps));

  adminRouter.use(requireAdmin);
  adminRouter.use((request, _response, next) => {
    if (isWriteMethod(request.method)) {
      deps.ensureTrustedOrigin(request, deps.allowedOrigins);
      deps.verifyCsrfToken(request);
    }

    next();
  });

  adminRouter.use(createAdminCoreRoutes(deps));
  adminRouter.use(createAdminEngagementRoutes(deps));
  adminRouter.use(createMaintenanceRoutes(deps));
  router.use('/admin', adminRouter);

  router.use((_request, response) => {
    response.status(404).json({ error: 'API route not found.' });
  });

  return router;
}

export default createApiRouter;
