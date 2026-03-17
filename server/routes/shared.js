import { createHttpError } from '../logger.js';

export const RESOURCE_TABLES = new Set(['freebies', 'gear']);
export const ORDERABLE_COLLECTIONS = new Map([
  ['links', 'links'],
  ['freebies', 'freebies'],
  ['gear', 'gear'],
  ['testimonials', 'testimonials'],
]);
export const BOOKING_STATUSES = new Set(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']);

export function asyncHandler(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export function toBoolean(value) {
  return Boolean(value);
}

export function requiredText(value, label, maxLength = null) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    throw createHttpError(400, `${label} is required.`);
  }

  if (maxLength && normalizedValue.length > maxLength) {
    throw createHttpError(400, `${label} must be ${maxLength} characters or less.`);
  }

  return normalizedValue;
}

export function optionalText(value, maxLength = null) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return null;
  }

  if (maxLength && normalizedValue.length > maxLength) {
    throw createHttpError(400, `Value must be ${maxLength} characters or less.`);
  }

  return normalizedValue;
}

export function requiredEmail(value, normalizeEmail) {
  const email = normalizeEmail(value);
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    throw createHttpError(400, 'A valid email address is required.');
  }

  return email;
}

export function integerValue(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function optionalInteger(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  return integerValue(value);
}

export function ratingValue(value) {
  const parsed = integerValue(value, 5);
  if (parsed < 1 || parsed > 5) {
    throw createHttpError(400, 'Rating must be between 1 and 5.');
  }

  return parsed;
}

export function assertResourceTable(table) {
  if (!RESOURCE_TABLES.has(table)) {
    throw createHttpError(400, `Unsupported resource table: ${table}`);
  }

  return table;
}

export function assertOrderableCollection(collection) {
  const table = ORDERABLE_COLLECTIONS.get(collection);
  if (!table) {
    throw createHttpError(400, `Unsupported sortable collection: ${collection}`);
  }

  return table;
}

export function normalizeLink(row) {
  return {
    ...row,
    is_active: toBoolean(row.is_active),
  };
}

export function normalizeModule(row) {
  return {
    ...row,
    is_enabled: toBoolean(row.is_enabled),
  };
}

export function normalizeTestimonial(row) {
  return {
    ...row,
    is_featured: toBoolean(row.is_featured),
  };
}

export function normalizeMessage(row) {
  return {
    ...row,
    is_read: toBoolean(row.is_read),
  };
}

export async function ensureUniqueLink(deps, payload, currentId = '') {
  const duplicate = await deps.one(
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

export async function ensureUniqueResource(deps, table, payload, currentId = '') {
  const duplicate = await deps.one(
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

export async function ensureUniqueTestimonial(deps, payload, currentId = '') {
  const duplicate = await deps.one(
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

export async function getCount(deps, sql, params = []) {
  const row = await deps.one(sql, params);
  return row?.count ?? 0;
}

export async function getNextDisplayOrder(deps, table) {
  const row = await deps.one(`SELECT COALESCE(MAX(display_order), -1) AS maxOrder FROM ${table}`);
  return Number(row?.maxOrder ?? -1) + 1;
}

export async function getExistingDisplayOrder(deps, table, id) {
  const row = await deps.one(`SELECT display_order FROM ${table} WHERE id = ? LIMIT 1`, [id]);
  return Number(row?.display_order ?? 0);
}

export async function updateDisplayOrder(deps, table, orderedIds) {
  await deps.transaction(async (helpers) => {
    for (let index = 0; index < orderedIds.length; index += 1) {
      await helpers.query(
        `UPDATE ${table} SET display_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [index, orderedIds[index]]
      );
    }
  });
}
