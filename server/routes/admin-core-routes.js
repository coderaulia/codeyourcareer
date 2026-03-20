import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { createHttpError } from '../logger.js';
import {
  assertOrderableCollection,
  assertResourceTable,
  asyncHandler,
  ensureUniqueLink,
  ensureUniqueResource,
  getCount,
  getExistingDisplayOrder,
  getNextDisplayOrder,
  optionalInteger,
  optionalText,
  requiredText,
  updateDisplayOrder,
  normalizeLink,
} from './shared.js';

function normalizeLinkPayload(payload) {
  const linkType = optionalText(payload.link_type, 30) || 'external';
  if (!['external', 'internal'].includes(linkType)) {
    throw createHttpError(400, 'Link type must be external or internal.');
  }

  const internalTarget = optionalText(payload.internal_target, 80);
  if (linkType === 'internal' && !internalTarget) {
    throw createHttpError(400, 'Internal links must have a target section.');
  }

  const url = linkType === 'internal' ? optionalText(payload.url) || `#${internalTarget}` : requiredText(payload.url, 'Link URL');

  return {
    title: requiredText(payload.title, 'Link title', 255),
    url,
    icon: optionalText(payload.icon, 80) || 'bi-link-45deg',
    display_order: optionalInteger(payload.display_order),
    is_active: payload.is_active ? 1 : 0,
    link_type: linkType,
    internal_target: linkType === 'internal' ? internalTarget : null,
    style_bg: linkType === 'internal' ? optionalText(payload.style_bg, 40) : null,
  };
}

function normalizeResourcePayload(table, payload) {
  const normalized = {
    title: requiredText(payload.title, 'Title', 255),
    link: requiredText(payload.link, 'Link'),
    image_url: optionalText(payload.image_url),
    display_order: optionalInteger(payload.display_order),
  };

  if (table === 'freebies') {
    normalized.description = optionalText(payload.description);
  } else {
    normalized.category = optionalText(payload.category, 255);
  }

  return normalized;
}

export function createAdminCoreRoutes(deps) {
  const router = Router();

  router.get('/setup-status', asyncHandler(async (_request, response) => {
    const [links, siteName] = await Promise.all([
      deps.one('SELECT COUNT(*) AS count FROM links WHERE is_active = 1'),
      deps.one('SELECT site_name FROM site_settings WHERE id = 1'),
    ]);

    const hasContent = Number(links?.count || 0) > 0;
    const isConfigured = siteName?.site_name && siteName.site_name !== 'CodeYourCareer.my.id';

    response.json({
      data: {
        needsSetup: !isConfigured && !hasContent,
        hasContent,
        isConfigured,
      },
    });
  }));

  router.post('/setup-complete', asyncHandler(async (request, response) => {
    response.json({ data: { success: true } });
  }));

  router.get('/dashboard-stats', asyncHandler(async (_request, response) => {
    const [links, bookings, messages, clicks] = await Promise.all([
      getCount(deps, 'SELECT COUNT(*) AS count FROM links WHERE is_active = 1'),
      getCount(deps, 'SELECT COUNT(*) AS count FROM bookings WHERE status = ?', ['pending']),
      getCount(deps, 'SELECT COUNT(*) AS count FROM contact_messages WHERE is_read = 0'),
      getCount(
        deps,
        `SELECT COUNT(*) AS count
         FROM analytics_events
         WHERE event_type IN ('link_click', 'resource_click')`
      ),
    ]);

    response.json({ data: { links, bookings, messages, clicks } });
  }));

  router.put('/site-settings', asyncHandler(async (request, response) => {
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

    await deps.query(
      `UPDATE site_settings SET
        site_name = ?, headline = ?, subheadline = ?, footer_text = ?, logo_type = ?, logo_svg = ?,
        logo_image_url = ?, logo_emoji = ?, bg_color = ?, text_color = ?, text_secondary = ?, accent_color = ?,
        card_bg = ?, card_border = ?, cta_bg = ?, cta_text = ?, cta_btn_bg = ?, cta_btn_text = ?,
        cta_title = ?, cta_subtitle = ?, cta_button_text = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1`,
      values
    );

    response.json({ data: { success: true } });
  }));

  router.post('/uploads/image', asyncHandler(async (request, response) => {
    const file = await deps.runImageUpload(deps.imageUploadMiddleware, request, response);
    if (!file) {
      throw createHttpError(400, 'Choose an image to upload.');
    }

    response.status(201).json({
      data: {
        success: true,
        filename: file.filename,
        url: deps.buildUploadUrl(request, file.filename),
      },
    });
  }));

  router.put('/modules/:slug', asyncHandler(async (request, response) => {
    await deps.query('UPDATE modules SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE slug = ?', [
      request.body?.is_enabled ? 1 : 0,
      request.params.slug,
    ]);

    response.json({ data: { success: true } });
  }));

  router.put('/order/:collection', asyncHandler(async (request, response) => {
    const table = assertOrderableCollection(request.params.collection);
    const orderedIds = Array.isArray(request.body?.orderedIds)
      ? request.body.orderedIds.map((value) => String(value || '').trim()).filter(Boolean)
      : [];

    if (!orderedIds.length) {
      throw createHttpError(400, 'Ordered item ids are required.');
    }

    await updateDisplayOrder(deps, table, orderedIds);
    response.json({ data: { success: true } });
  }));

  router.get('/links', asyncHandler(async (_request, response) => {
    const rows = await deps.query('SELECT * FROM links ORDER BY display_order ASC, created_at ASC');
    response.json({ data: rows.map(normalizeLink) });
  }));

  router.post('/links', asyncHandler(async (request, response) => {
    const payload = normalizeLinkPayload(request.body ?? {});
    await ensureUniqueLink(deps, payload);
    const displayOrder = payload.display_order ?? (await getNextDisplayOrder(deps, 'links'));

    await deps.query(
      `INSERT INTO links (id, title, url, icon, display_order, is_active, link_type, internal_target, style_bg)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), payload.title, payload.url, payload.icon, displayOrder, payload.is_active, payload.link_type, payload.internal_target, payload.style_bg]
    );

    response.status(201).json({ data: { success: true } });
  }));

  router.put('/links/:id', asyncHandler(async (request, response) => {
    const payload = normalizeLinkPayload(request.body ?? {});
    await ensureUniqueLink(deps, payload, request.params.id);
    const displayOrder = payload.display_order ?? (await getExistingDisplayOrder(deps, 'links', request.params.id));

    await deps.query(
      `UPDATE links SET
        title = ?, url = ?, icon = ?, display_order = ?, is_active = ?, link_type = ?,
        internal_target = ?, style_bg = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [payload.title, payload.url, payload.icon, displayOrder, payload.is_active, payload.link_type, payload.internal_target, payload.style_bg, request.params.id]
    );

    response.json({ data: { success: true } });
  }));

  router.delete('/links/:id', asyncHandler(async (request, response) => {
    await deps.query('DELETE FROM links WHERE id = ?', [request.params.id]);
    response.json({ data: { success: true } });
  }));

  router.post('/resources/:table', asyncHandler(async (request, response) => {
    const table = assertResourceTable(request.params.table);
    const payload = normalizeResourcePayload(table, request.body ?? {});
    await ensureUniqueResource(deps, table, payload);
    const displayOrder = payload.display_order ?? (await getNextDisplayOrder(deps, table));

    if (table === 'freebies') {
      await deps.query(
        'INSERT INTO freebies (id, title, description, link, image_url, display_order) VALUES (?, ?, ?, ?, ?, ?)',
        [randomUUID(), payload.title, payload.description, payload.link, payload.image_url, displayOrder]
      );
    } else {
      await deps.query(
        'INSERT INTO gear (id, title, category, link, image_url, display_order) VALUES (?, ?, ?, ?, ?, ?)',
        [randomUUID(), payload.title, payload.category, payload.link, payload.image_url, displayOrder]
      );
    }

    response.status(201).json({ data: { success: true } });
  }));

  router.put('/resources/:table/:id', asyncHandler(async (request, response) => {
    const table = assertResourceTable(request.params.table);
    const payload = normalizeResourcePayload(table, request.body ?? {});
    await ensureUniqueResource(deps, table, payload, request.params.id);
    const displayOrder = payload.display_order ?? (await getExistingDisplayOrder(deps, table, request.params.id));

    if (table === 'freebies') {
      await deps.query(
        `UPDATE freebies SET
          title = ?, description = ?, link = ?, image_url = ?, display_order = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [payload.title, payload.description, payload.link, payload.image_url, displayOrder, request.params.id]
      );
    } else {
      await deps.query(
        `UPDATE gear SET
          title = ?, category = ?, link = ?, image_url = ?, display_order = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [payload.title, payload.category, payload.link, payload.image_url, displayOrder, request.params.id]
      );
    }

    response.json({ data: { success: true } });
  }));

  router.delete('/resources/:table/:id', asyncHandler(async (request, response) => {
    const table = assertResourceTable(request.params.table);
    await deps.query(`DELETE FROM ${table} WHERE id = ?`, [request.params.id]);
    response.json({ data: { success: true } });
  }));

  return router;
}
