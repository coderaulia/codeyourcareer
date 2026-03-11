import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { one, query } from '../db.js';

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
    response.status(401).json({ error: 'Authentication required.' });
    return;
  }

  next();
}

function assertResourceTable(table) {
  if (!RESOURCE_TABLES.has(table)) {
    const error = new Error(`Unsupported resource table: ${table}`);
    error.statusCode = 400;
    throw error;
  }

  return table;
}

function toBoolean(value) {
  return Boolean(value);
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

async function getCount(sql, params = []) {
  const row = await one(sql, params);
  return row?.count ?? 0;
}

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
    const { name, email, topic, schedule } = request.body ?? {};
    if (!name || !email || !topic || !schedule) {
      response.status(400).json({ error: 'Name, email, topic, and schedule are required.' });
      return;
    }

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
    const { name, email, message } = request.body ?? {};
    if (!name || !email || !message) {
      response.status(400).json({ error: 'Name, email, and message are required.' });
      return;
    }

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
    const { linkId = null, linkTitle = null } = request.body ?? {};

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
    const { email, password } = request.body ?? {};
    if (!email || !password) {
      response.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const adminUser = await one(
      'SELECT id, email, password_hash, role FROM admin_users WHERE email = ? LIMIT 1',
      [email]
    );

    if (!adminUser) {
      response.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, adminUser.password_hash);
    if (!passwordMatches) {
      response.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    request.session.adminUser = {
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
    };

    response.json({
      data: {
        authenticated: true,
        user: request.session.adminUser,
      },
    });
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
      getCount('SELECT COUNT(*) AS count FROM links'),
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
      payload.site_name ?? '',
      payload.headline ?? '',
      payload.subheadline ?? '',
      payload.footer_text ?? '',
      payload.logo_type ?? 'svg',
      payload.logo_svg ?? '',
      payload.logo_image_url || null,
      payload.logo_emoji || null,
      payload.bg_color ?? '#f8f9fa',
      payload.text_color ?? '#111111',
      payload.text_secondary ?? '#555555',
      payload.accent_color ?? '#000000',
      payload.card_bg ?? '#ffffff',
      payload.card_border ?? '#e0e0e0',
      payload.cta_bg ?? '#111111',
      payload.cta_text ?? '#ffffff',
      payload.cta_btn_bg ?? '#ffffff',
      payload.cta_btn_text ?? '#000000',
      payload.cta_title ?? 'Ready to debug your career?',
      payload.cta_subtitle ?? '1:1 Session for Students, Job Seekers & Professionals.',
      payload.cta_button_text ?? 'Mulai Konsultasi Karir Sekarang!',
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
    const rows = await query('SELECT * FROM links ORDER BY display_order ASC');
    response.json({ data: rows.map(normalizeLink) });
  })
);

adminRouter.post(
  '/links',
  asyncHandler(async (request, response) => {
    const payload = request.body ?? {};
    await query(
      `INSERT INTO links (
        id, title, url, icon, display_order, is_active, link_type, internal_target, style_bg
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        payload.title,
        payload.url,
        payload.icon || 'bi-link-45deg',
        Number(payload.display_order || 0),
        payload.is_active ? 1 : 0,
        payload.link_type || 'external',
        payload.internal_target || null,
        payload.style_bg || null,
      ]
    );

    response.status(201).json({ data: { success: true } });
  })
);

adminRouter.put(
  '/links/:id',
  asyncHandler(async (request, response) => {
    const payload = request.body ?? {};
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
        payload.icon || 'bi-link-45deg',
        Number(payload.display_order || 0),
        payload.is_active ? 1 : 0,
        payload.link_type || 'external',
        payload.internal_target || null,
        payload.style_bg || null,
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
    const payload = request.body ?? {};

    if (table === 'freebies') {
      await query(
        'INSERT INTO freebies (id, title, description, link, display_order) VALUES (?, ?, ?, ?, ?)',
        [randomUUID(), payload.title, payload.description || null, payload.link, Number(payload.display_order || 0)]
      );
    } else {
      await query(
        'INSERT INTO gear (id, title, category, link, display_order) VALUES (?, ?, ?, ?, ?)',
        [randomUUID(), payload.title, payload.category || null, payload.link, Number(payload.display_order || 0)]
      );
    }

    response.status(201).json({ data: { success: true } });
  })
);

adminRouter.put(
  '/resources/:table/:id',
  asyncHandler(async (request, response) => {
    const table = assertResourceTable(request.params.table);
    const payload = request.body ?? {};

    if (table === 'freebies') {
      await query(
        `UPDATE freebies SET
          title = ?,
          description = ?,
          link = ?,
          display_order = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          payload.title,
          payload.description || null,
          payload.link,
          Number(payload.display_order || 0),
          request.params.id,
        ]
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
        [
          payload.title,
          payload.category || null,
          payload.link,
          Number(payload.display_order || 0),
          request.params.id,
        ]
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
    const { meetlink } = request.body ?? {};
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
    const rows = await query('SELECT * FROM testimonials ORDER BY display_order ASC');
    response.json({ data: rows.map(normalizeTestimonial) });
  })
);

adminRouter.post(
  '/testimonials',
  asyncHandler(async (request, response) => {
    const payload = request.body ?? {};
    await query(
      'INSERT INTO testimonials (id, name, role, content, rating, is_featured, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        randomUUID(),
        payload.name,
        payload.role || null,
        payload.content,
        Number(payload.rating || 5),
        payload.is_featured === false ? 0 : 1,
        Number(payload.display_order || 0),
      ]
    );

    response.status(201).json({ data: { success: true } });
  })
);

adminRouter.put(
  '/testimonials/:id',
  asyncHandler(async (request, response) => {
    const payload = request.body ?? {};
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
        payload.role || null,
        payload.content,
        Number(payload.rating || 5),
        payload.is_featured === false ? 0 : 1,
        Number(payload.display_order || 0),
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
    const limit = Number(request.query.limit || 100);
    const rows = await query(
      'SELECT link_title, clicked_at FROM link_clicks ORDER BY clicked_at DESC LIMIT ?',
      [Number.isFinite(limit) ? limit : 100]
    );
    response.json({ data: rows });
  })
);

router.use('/admin', adminRouter);

router.use((_request, response) => {
  response.status(404).json({ error: 'API route not found.' });
});

export default router;
