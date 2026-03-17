import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { createHttpError, logInfo } from '../logger.js';
import { asyncHandler, requiredEmail, requiredText } from './shared.js';

async function getValidatedSessionUser(request, deps) {
  const sessionUser = request.session?.adminUser;
  if (!sessionUser?.id) {
    return null;
  }

  const adminUser = await deps.findAdminUserById(sessionUser.id, { one: deps.one });
  if (!adminUser) {
    request.session = null;
    return null;
  }

  const currentVersion = Number(adminUser.session_version || 1);
  if (currentVersion !== Number(sessionUser.sessionVersion || 1)) {
    request.session = null;
    return null;
  }

  const normalizedUser = {
    id: adminUser.id,
    email: adminUser.email,
    role: adminUser.role,
    sessionVersion: currentVersion,
  };

  request.session.adminUser = normalizedUser;
  return normalizedUser;
}

export function createRequireAdmin(deps) {
  return asyncHandler(async (request, response, next) => {
    const user = await getValidatedSessionUser(request, deps);
    if (!user) {
      response.status(401).json({
        error: 'Authentication required. Please sign in again.',
        requestId: request.requestId,
      });
      return;
    }

    request.adminUser = user;
    next();
  });
}

export function createAuthRouter(deps) {
  const router = Router();
  const requireAdmin = createRequireAdmin(deps);

  router.get(
    '/session',
    asyncHandler(async (request, response) => {
      const user = await getValidatedSessionUser(request, deps);
      response.json({
        data: {
          authenticated: Boolean(user),
          user,
          csrfToken: user ? deps.getCsrfToken(request) : null,
        },
      });
    })
  );

  router.post(
    '/login',
    asyncHandler(async (request, response) => {
      deps.ensureTrustedOrigin(request, deps.allowedOrigins);

      const email = requiredEmail(request.body?.email, deps.normalizeEmail);
      const password = requiredText(request.body?.password, 'Password', 255);

      deps.loginRateLimiter.check(request, email);

      const adminUser = await deps.findAdminUserByEmail(email, { one: deps.one });
      if (!adminUser) {
        deps.loginRateLimiter.record(request, email, false);
        throw createHttpError(401, 'Invalid email or password.');
      }

      const passwordMatches = await bcrypt.compare(password, adminUser.password_hash);
      if (!passwordMatches) {
        deps.loginRateLimiter.record(request, email, false);
        throw createHttpError(401, 'Invalid email or password.');
      }

      deps.loginRateLimiter.record(request, email, true);
      const sessionVersion = Number(adminUser.session_version || 1);
      request.session = {
        ...(request.session || {}),
        adminUser: {
          id: adminUser.id,
          email: adminUser.email,
          role: adminUser.role,
          sessionVersion,
        },
      };

      const csrfToken = deps.issueCsrfToken(request);

      logInfo('admin_login_success', {
        requestId: request.requestId,
        userId: adminUser.id,
        email: adminUser.email,
      });

      response.json({
        data: {
          authenticated: true,
          user: request.session.adminUser,
          csrfToken,
        },
      });
    })
  );

  router.post(
    '/change-password',
    requireAdmin,
    asyncHandler(async (request, response) => {
      deps.ensureTrustedOrigin(request, deps.allowedOrigins);
      deps.verifyCsrfToken(request);

      const currentPassword = requiredText(request.body?.currentPassword, 'Current password', 255);
      const newPassword = requiredText(request.body?.newPassword, 'New password', 255);
      const confirmPassword = requiredText(request.body?.confirmPassword, 'Password confirmation', 255);

      if (newPassword.length < 10) {
        throw createHttpError(400, 'New password must be at least 10 characters long.');
      }

      if (newPassword !== confirmPassword) {
        throw createHttpError(400, 'New password and confirmation do not match.');
      }

      if (newPassword === currentPassword) {
        throw createHttpError(400, 'Choose a new password that is different from the current password.');
      }

      const validPassword = await deps.verifyAdminPassword(request.adminUser.id, currentPassword);
      if (!validPassword) {
        throw createHttpError(400, 'Current password is incorrect.');
      }

      const nextSessionVersion = await deps.updatePasswordAndRotateSession(request.adminUser.id, newPassword);
      request.session = {
        ...(request.session || {}),
        adminUser: {
          ...request.adminUser,
          sessionVersion: nextSessionVersion,
        },
      };

      const csrfToken = deps.issueCsrfToken(request);

      logInfo('admin_password_changed', {
        requestId: request.requestId,
        userId: request.adminUser.id,
        email: request.adminUser.email,
      });

      response.json({ data: { success: true, csrfToken } });
    })
  );

  router.post(
    '/logout',
    asyncHandler(async (request, response) => {
      deps.ensureTrustedOrigin(request, deps.allowedOrigins);
      deps.verifyCsrfToken(request);

      const user = await getValidatedSessionUser(request, deps);
      if (user) {
        await deps.rotateAdminSession(user.id, { query: deps.query, one: deps.one });
      }

      request.session = null;
      response.json({ data: { success: true } });
    })
  );

  return router;
}
