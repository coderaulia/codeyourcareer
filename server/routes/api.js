import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import {
  findAdminUserByEmail,
  normalizeEmail,
  updateAdminPassword,
  verifyAdminPassword,
} from '../admin-user.js';
import { one, query } from '../db.js';
import { createHttpError, getDeployInfo, logInfo } from '../logger.js';

const router = Router();
const adminRouter = Router();
const RESOURCE_TABLES = new Set(['freebies', 'gear']);

function asyncHandler(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

function requireAdmin(request, response, next) {
  if (!request.session?.adminUser) {
    response.status(401).json({
      error: 'Authentication required. Please sign in again.',
      requestId: request.requestId,
    });
    return;
  }

  next();
}

function assertResourceTable(table) {
  if (!RESOURCE_TABLES.has(table)) {
    throw createHttpError(400, `Unsupported resource table: ${table}`);
  }

  return table;
}

function toBoolean(value) {
  return Boolean(value);
}

function requiredText(value, label, maxLength = null) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    throw createHttpError(400, `${label} is required.`);
  }

  if (maxLength && normalizedValue.length > maxLength) {
    throw createHttpError(400, `${label} must be ${maxLength} characters or less.`);
  }

  return normalizedValue;
}

function optionalText(value, maxLength = null) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return null;
  }

  if (maxLength && normalizedValue.length > maxLength) {
    throw createHttpError(400, `Value must be ${maxLength} characters or less.`);
  }

  return normalizedValue;
}

function requiredEmail(value) {
  const email = normalizeEmail(value);
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    throw createHttpError(400, 'A valid email address is required.');
  }

  return email;
}

function integerValue(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ratingValue(value) {
  const parsed = integerValue(value, 5);
  if (parsed < 1 || parsed > 5) {
    throw createHttpError(400, 'Rating must be between 1 and 5.');
  }

  return parsed;
}

function normalizeLink(row) {
  return {
    ...row,
    is_active: toBoolean(row.is_active),
  };
}

function normalizeModule(row) {
  return {
    ...row,
    is_enabled: toBoolean(row.is_enabled),
  };
}

function normalizeTestimonial(row) {
  return {
    ...row,
    is_featured: toBoolean(row.is_featured),
  };
}

function normalizeMessage(row) {
  return {
    ...row,
    is_read: toBoolean(row.is_read),
  };
}

function normalizeLinkPayload(payload) {
  const linkType = optionalText(payload.link_type, 30) || 'external';
  if (!['external', 'internal'].includes(linkType)) {
    throw createHttpError(400, 'Link type must be external or internal.');
  }

  const internalTarget = optionalText(payload.internal_target, 80);
  if (linkType === 'internal' && !internalTarget) {
    throw createHttpError(400, 'Internal links must have a target section.');
  }

  return {
    title: requiredText(payload.title, 'Link title', 255),
    url: requiredText(payload.url, 'Link URL'),
    icon: optionalText(payload.icon, 80) || 'bi-link-45deg',
    display_order: integerValue(payload.display_order),
    is_active: payload.is_active ? 1 : 0,
    link_type: linkType,
    internal_target: linkType === 'internal' ? internalTarget : null,
    style_bg: optionalText(payload.style_bg, 40),
  };
}

function normalizeResourcePayload(table, payload) {
  const normalized = {
    title: requiredText(payload.title, 'Title', 255),
    link: requiredText(payload.link, 'Link'),
    display_order: integerValue(payload.display_order),
  };

  if (table === 'freebies') {
    normalized.description = optionalText(payload.description);
  } else {
    normalized.category = optionalText(payload.category, 255);
  }

  return normalized;
}

function normalizeTestimonialPayload(payload) {
  return {
    name: requiredText(payload.name, 'Name', 255),
    role: optionalText(payload.role, 255),
    content: requiredText(payload.content, 'Testimonial', 2000),
    rating: ratingValue(payload.rating),
    is_featured: payload.is_featured === false ? 0 : 1,
    display_order: integerValue(payload.display_order),
  };
}

async function ensureUniqueLink(payload, currentId = '') {
  const duplicate = await one(
    `SELECT id FROM links
     WHERE id <> ?
       AND (
         LOWER(TRIM(title)) = LOWER(TRIM(?))
         OR LOWER(TRIM(url)) = LOWER(TRIM(?))
       )
     LIMIT 1`,
    [currentId, payload.title, payload.url]
  );

  if (duplicate) {
    throw createHttpError(409, 'A link with the same title or URL already exists.');
  }
}

async function ensureUniqueResource(table, payload, currentId = '') {
  const duplicate = await one(
    `SELECT id FROM ${table}
     WHERE id <> ?
       AND (
         LOWER(TRIM(title)) = LOWER(TRIM(?))
         OR LOWER(TRIM(link)) = LOWER(TRIM(?))
       )
     LIMIT 1`,
    [currentId, payload.title, payload.link]
  );

  if (duplicate) {
    throw createHttpError(409, 'A resource with the same title or URL already exists.');
  }
}

async function ensureUniqueTestimonial(payload, currentId = '') {
  const duplicate = await one(
    `SELECT id FROM testimonials
     WHERE id <> ?
       AND LOWER(TRIM(name)) = LOWER(TRIM(?))
       AND LOWER(TRIM(content)) = LOWER(TRIM(?))
     LIMIT 1`,
    [currentId, payload.name, payload.content]
  );

  if (duplicate) {
    throw createHttpError(409, 'This testimonial already exists.');
  }
}

async function getCount(sql, params = []) {
  const row = await one(sql, params);
  return row?.count ?? 0;
}

router.get('/version', (_request, response) => {
  response.json({
    data: getDeployInfo(),
  });
});

router.get(
  '/site-settings',
  asyncHandler(async (_request, response) => {
    const row = await one('SELECT * FROM site_settings WHERE id = 1 LIMIT 1');
    response.json({ data: row });
  })
);

router.get(
  '/modules',
  asyncHandler(async (_request, response) => {
    const rows = await query('SELECT * FROM modules ORDER BY display_order ASC');
    response.json({ data: rows.map(normalizeModule) });
  })
);

router.get(
  '/links/active',
  asyncHandler(async (_request, response) => {
    const rows = await query('SELECT * FROM links WHERE is_active = 1 ORDER BY display_order ASC');
    response.json({ data: rows.map(normalizeLink) });
  })
);

router.get(
  '/resources/:table',
  asyncHandler(async (request, response) => {
    const table = assertResourceTable(request.params.table);
    const rows = await query(`SELECT * FROM ${table} ORDER BY display_order ASC`);
    response.json({ data: rows });
  })
);

router.post(
  '/bookings',
  asyncHandler(async (request, response) => {
    const name = requiredText(request.body?.name, 'Name', 255);
    const email = requiredEmail(request.body?.email);
    const topic = requiredText(request.body?.topic, 'Topic', 255);
    const schedule = requiredText(request.body?.schedule, 'Schedule');

    await query(
      'INSERT INTO bookings (id, name, email, topic, schedule) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), name, email, topic, schedule]
    );

    response.status(201).json({ data: { success: true } });
  })
);

router.get(
  '/testimonials/featured',
  asyncHandler(async (_request, response) => {
    const rows = await query(
      'SELECT * FROM testimonials WHERE is_featured = 1 ORDER BY display_order ASC'
    );
    response.json({ data: rows.map(normalizeTestimonial) });
  })
);

router.post(
  '/contact-messages',
  asyncHandler(async (request, response) => {
    const name = requiredText(request.body?.name, 'Name', 255);
    const email = requiredEmail(request.body?.email);
    const message = requiredText(request.body?.message, 'Message', 2000);

    await query(
      'INSERT INTO contact_messages (id, name, email, message) VALUES (?, ?, ?, ?)',
      [randomUUID(), name, email, message]
    );

    response.status(201).json({ data: { success: true } });
  })
);

router.post(
  '/link-clicks',
  asyncHandler(async (request, response) => {
    const linkId = optionalText(request.body?.linkId, 36);
    const linkTitle = optionalText(request.body?.linkTitle, 255);

    await query(
      'INSERT INTO link_clicks (id, link_id, link_title) VALUES (?, ?, ?)',
      [randomUUID(), linkId, linkTitle]
    );

    response.status(201).json({ data: { success: true } });
  })
);

router.get(
  '/auth/session',
  asyncHandler(async (request, response) => {
    const user = request.session?.adminUser ?? null;
    response.json({
      data: {
        authenticated: Boolean(user),
        user,
      },
    });
  })
);

router.post(
  '/auth/login',
  asyncHandler(async (request, response) => {
    const email = requiredEmail(request.body?.email);
    const password = requiredText(request.body?.password, 'Password', 255);

    const adminUser = await findAdminUserByEmail(email);
    if (!adminUser) {
      throw createHttpError(401, 'Invalid email or password.');
    }

    const passwordMatches = await bcrypt.compare(password, adminUser.password_hash);
    if (!passwordMatches) {
      throw createHttpError(401, 'Invalid email or password.');
    }

    request.session.adminUser = {
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
    };

    logInfo('admin_login_success', {
      requestId: request.requestId,
      userId: adminUser.id,
      email: adminUser.email,
    });

    response.json({
      data: {
        authenticated: true,
        user: request.session.adminUser,
      },
    });
  })
);

router.post(
  '/auth/change-password',
  requireAdmin,
  asyncHandler(async (request, response) => {
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

    const validPassword = await verifyAdminPassword(request.session.adminUser.id, currentPassword);
    if (!validPassword) {
      throw createHttpError(400, 'Current password is incorrect.');
    }

    await updateAdminPassword(request.session.adminUser.id, newPassword);

    logInfo('admin_password_changed', {
      requestId: request.requestId,
      userId: request.session.adminUser.id,
      email: request.session.adminUser.email,
    });

    response.json({ data: { success: true } });
  })
);

router.post(
  '/auth/logout',
  asyncHandler(async (request, response) => {
    request.session = null;
    response.json({ data: { success: true } });
  })
);

adminRouter.use(requireAdmin);

adminRouter.get(
  '/dashboard-stats',
  asyncHandler(async (_request, response) => {
    const [links, bookings, messages, clicks] = await Promise.all([
      getCount('SELECT COUNT(*) AS count FROM links WHERE is_active = 1'),
      getCount('SELECT COUNT(*) AS count FROM bookings WHERE status = ?', ['pending']),
      getCount('SELECT COUNT(*) AS count FROM contact_messages WHERE is_read = 0'),
      getCount('SELECT COUNT(*) AS count FROM link_clicks'),
    ]);

    response.json({
      data: {
        links,
        bookings,
        messages,
        clicks,
      },
    });
  })
);

adminRouter.put(
  '/site-settings',
  asyncHandler(async (request, response) => {
    const payload = request.body ?? {};
    const values = [
      requiredText(payload.site_name, 'Site name', 255),
      requiredText(payload.headline, 'Headline', 255),
      optionalText(payload.subheadline),
      requiredText(payload.footer_text, 'Footer text', 255),
      optionalText(payload.logo_type, 20) || 'svg',
      String(payload.logo_svg || ''),
      optionalText(payload.logo_image_url),
      optionalText(payload.logo_emoji, 16),
      optionalText(payload.bg_color, 20) || '#f8f9fa',
      optionalText(payload.text_color, 20) || '#111111',
      optionalText(payload.text_secondary, 20) || '#555555',
      optionalText(payload.accent_color, 20) || '#000000',
      optionalText(payload.card_bg, 20) || '#ffffff',
      optionalText(payload.card_border, 20) || '#e0e0e0',
      optionalText(payload.cta_bg, 20) || '#111111',
      optionalText(payload.cta_text, 20) || '#ffffff',
      optionalText(payload.cta_btn_bg, 20) || '#ffffff',
      optionalText(payload.cta_btn_text, 20) || '#000000',
      requiredText(payload.cta_title, 'CTA title', 255),
      requiredText(payload.cta_subtitle, 'CTA subtitle', 255),
      requiredText(payload.cta_button_text, 'CTA button text', 255),
    ];

    await query(
      `UPDATE site_settings SET
        site_name = ?,
        headline = ?,
        subheadline = ?,
        footer_text = ?,
        logo_type = ?,
        logo_svg = ?,
        logo_image_url = ?,
        logo_emoji = ?,
        bg_color = ?,
        text_color = ?,
        text_secondary = ?,
        accent_color = ?,
        card_bg = ?,
        card_border = ?,
        cta_bg = ?,
        cta_text = ?,
        cta_btn_bg = ?,
        cta_btn_text = ?,
        cta_title = ?,
        cta_subtitle = ?,
        cta_button_text = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1`,
      values
    );

    response.json({ data: { success: true } });
  })
);

adminRouter.put(
  '/modules/:slug',
  asyncHandler(async (request, response) => {
    await query('UPDATE modules SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE slug = ?', [
      request.body?.is_enabled ? 1 : 0,
      request.params.slug,
    ]);

    response.json({ data: { success: true } });
  })
);

adminRouter.get(
  '/links',
  asyncHandler(async (_request, response) => {
    const rows = await query('SELECT * FROM links ORDER BY display_order ASC, created_at ASC');
    response.json({ data: rows.map(normalizeLink) });
  })
);

adminRouter.post(
  '/links',
  asyncHandler(async (request, response) => {
    const payload = normalizeLinkPayload(request.body ?? {});
    await ensureUniqueLink(payload);

    await query(
      `INSERT INTO links (
        id, title, url, icon, display_order, is_active, link_type, internal_target, style_bg
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        payload.title,
        payload.url,
        payload.icon,
        payload.display_order,
        payload.is_active,
        payload.link_type,
        payload.internal_target,
        payload.style_bg,
      ]
    );

    response.status(201).json({ data: { success: true } });
  })
);

adminRouter.put(
  '/links/:id',
  asyncHandler(async (request, response) => {
    const payload = normalizeLinkPayload(request.body ?? {});
    await ensureUniqueLink(payload, request.params.id);

    await query(
      `UPDATE links SET
        title = ?,
        url = ?,
        icon = ?,
        display_order = ?,
        is_active = ?,
        link_type = ?,
        internal_target = ?,
        style_bg = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        payload.title,
        payload.url,
        payload.icon,
        payload.display_order,
        payload.is_active,
        payload.link_type,
        payload.internal_target,
        payload.style_bg,
        request.params.id,
      ]
    );

    response.json({ data: { success: true } });
  })
);

adminRouter.delete(
  '/links/:id',
  asyncHandler(async (request, response) => {
    await query('DELETE FROM links WHERE id = ?', [request.params.id]);
    response.json({ data: { success: true } });
  })
);

adminRouter.post(
  '/resources/:table',
  asyncHandler(async (request, response) => {
    const table = assertResourceTable(request.params.table);
    const payload = normalizeResourcePayload(table, request.body ?? {});
    await ensureUniqueResource(table, payload);

    if (table === 'freebies') {
      await query(
        'INSERT INTO freebies (id, title, description, link, display_order) VALUES (?, ?, ?, ?, ?)',
        [randomUUID(), payload.title, payload.description, payload.link, payload.display_order]
      );
    } else {
      await query(
        'INSERT INTO gear (id, title, category, link, display_order) VALUES (?, ?, ?, ?, ?)',
        [randomUUID(), payload.title, payload.category, payload.link, payload.display_order]
      );
    }

    response.status(201).json({ data: { success: true } });
  })
);

adminRouter.put(
  '/resources/:table/:id',
  asyncHandler(async (request, response) => {
    const table = assertResourceTable(request.params.table);
    const payload = normalizeResourcePayload(table, request.body ?? {});
    await ensureUniqueResource(table, payload, request.params.id);

    if (table === 'freebies') {
      await query(
        `UPDATE freebies SET
          title = ?,
          description = ?,
          link = ?,
          display_order = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [payload.title, payload.description, payload.link, payload.display_order, request.params.id]
      );
    } else {
      await query(
        `UPDATE gear SET
          title = ?,
          category = ?,
          link = ?,
          display_order = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [payload.title, payload.category, payload.link, payload.display_order, request.params.id]
      );
    }

    response.json({ data: { success: true } });
  })
);

adminRouter.delete(
  '/resources/:table/:id',
  asyncHandler(async (request, response) => {
    const table = assertResourceTable(request.params.table);
    await query(`DELETE FROM ${table} WHERE id = ?`, [request.params.id]);
    response.json({ data: { success: true } });
  })
);

adminRouter.get(
  '/bookings',
  asyncHandler(async (_request, response) => {
    const rows = await query('SELECT * FROM bookings ORDER BY created_at DESC');
    response.json({ data: rows });
  })
);

adminRouter.put(
  '/bookings/:id/confirm',
  asyncHandler(async (request, response) => {
    const meetlink = requiredText(request.body?.meetlink, 'Meet link');
    await query(
      'UPDATE bookings SET meetlink = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [meetlink, 'confirmed', request.params.id]
    );

    response.json({ data: { success: true } });
  })
);

adminRouter.delete(
  '/bookings/:id',
  asyncHandler(async (request, response) => {
    await query('DELETE FROM bookings WHERE id = ?', [request.params.id]);
    response.json({ data: { success: true } });
  })
);

adminRouter.get(
  '/testimonials',
  asyncHandler(async (_request, response) => {
    const rows = await query('SELECT * FROM testimonials ORDER BY display_order ASC, created_at ASC');
    response.json({ data: rows.map(normalizeTestimonial) });
  })
);

adminRouter.post(
  '/testimonials',
  asyncHandler(async (request, response) => {
    const payload = normalizeTestimonialPayload(request.body ?? {});
    await ensureUniqueTestimonial(payload);

    await query(
      'INSERT INTO testimonials (id, name, role, content, rating, is_featured, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        randomUUID(),
        payload.name,
        payload.role,
        payload.content,
        payload.rating,
        payload.is_featured,
        payload.display_order,
      ]
    );

    response.status(201).json({ data: { success: true } });
  })
);

adminRouter.put(
  '/testimonials/:id',
  asyncHandler(async (request, response) => {
    const payload = normalizeTestimonialPayload(request.body ?? {});
    await ensureUniqueTestimonial(payload, request.params.id);

    await query(
      `UPDATE testimonials SET
        name = ?,
        role = ?,
        content = ?,
        rating = ?,
        is_featured = ?,
        display_order = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        payload.name,
        payload.role,
        payload.content,
        payload.rating,
        payload.is_featured,
        payload.display_order,
        request.params.id,
      ]
    );

    response.json({ data: { success: true } });
  })
);

adminRouter.delete(
  '/testimonials/:id',
  asyncHandler(async (request, response) => {
    await query('DELETE FROM testimonials WHERE id = ?', [request.params.id]);
    response.json({ data: { success: true } });
  })
);

adminRouter.get(
  '/contact-messages',
  asyncHandler(async (_request, response) => {
    const rows = await query('SELECT * FROM contact_messages ORDER BY created_at DESC');
    response.json({ data: rows.map(normalizeMessage) });
  })
);

adminRouter.delete(
  '/contact-messages/:id',
  asyncHandler(async (request, response) => {
    await query('DELETE FROM contact_messages WHERE id = ?', [request.params.id]);
    response.json({ data: { success: true } });
  })
);

adminRouter.get(
  '/analytics/link-clicks',
  asyncHandler(async (request, response) => {
    const limit = integerValue(request.query.limit, 100);
    const rows = await query(
      'SELECT link_title, clicked_at FROM link_clicks ORDER BY clicked_at DESC LIMIT ?',
      [limit > 0 ? limit : 100]
    );
    response.json({ data: rows });
  })
);

router.use('/admin', adminRouter);

router.use((_request, response) => {
  response.status(404).json({ error: 'API route not found.' });
});

export default router;
