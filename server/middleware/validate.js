import { createHttpError } from '../logger.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SIZES = {
  title: 255,
  name: 255,
  email: 255,
  url: 2048,
  message: 10000,
  content: 50000,
  extra: 255,
  category: 255,
};

export function validateUuid(value, fieldName) {
  if (!value || !UUID_REGEX.test(String(value))) {
    throw createHttpError(400, `Invalid ${fieldName}: must be a valid UUID`);
  }
  return String(value);
}

export function validateEmail(value, fieldName = 'email') {
  const email = String(value || '').trim().toLowerCase();
  if (!email || !EMAIL_REGEX.test(email)) {
    throw createHttpError(400, `Invalid ${fieldName}`);
  }
  return email;
}

export function validateString(value, fieldName, options = {}) {
  const { required = false, maxLength = MAX_SIZES[fieldName] || 255, minLength = 0 } = options;
  const str = String(value ?? '').trim();

  if (required && !str) {
    throw createHttpError(400, `${fieldName} is required`);
  }
  if (str.length > maxLength) {
    throw createHttpError(400, `${fieldName} exceeds maximum length of ${maxLength}`);
  }
  if (str.length < minLength) {
    throw createHttpError(400, `${fieldName} must be at least ${minLength} characters`);
  }
  return str;
}

export function validateOptionalString(value, fieldName, maxLength = MAX_SIZES[fieldName] || 255) {
  if (!value || !String(value).trim()) return null;
  return validateString(value, fieldName, { maxLength });
}

export function validateBoolean(value, fieldName) {
  if (value === undefined || value === null) return undefined;
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  throw createHttpError(400, `${fieldName} must be a boolean`);
}

export function validateInteger(value, fieldName, options = {}) {
  const { min = 0, max = Number.MAX_SAFE_INTEGER } = options;
  const num = Number(value);
  if (!Number.isInteger(num)) {
    throw createHttpError(400, `${fieldName} must be an integer`);
  }
  if (num < min || num > max) {
    throw createHttpError(400, `${fieldName} must be between ${min} and ${max}`);
  }
  return num;
}

export function validateEnum(value, fieldName, allowedValues) {
  const val = String(value);
  if (!allowedValues.includes(val)) {
    throw createHttpError(400, `${fieldName} must be one of: ${allowedValues.join(', ')}`);
  }
  return val;
}

export function validateDate(value, fieldName) {
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw createHttpError(400, `Invalid ${fieldName}: must be a valid date`);
  }
  return date;
}

export function validateArray(value, fieldName, options = {}) {
  const { required = false, itemValidator = null } = options;
  if (!Array.isArray(value)) {
    if (required) {
      throw createHttpError(400, `${fieldName} must be an array`);
    }
    return [];
  }
  if (itemValidator) {
    return value.map((item, index) => {
      try {
        return itemValidator(item);
      } catch (error) {
        throw createHttpError(400, `${fieldName}[${index}]: ${error.message}`);
      }
    });
  }
  return value;
}

export function validateSortOrder(value) {
  const num = validateInteger(value, 'sort_order', { min: 0, max: 9999 });
  return num;
}

export function validateLinkType(value) {
  return validateEnum(value, 'link_type', ['external', 'internal']);
}

export function validateStatus(value, allowedStatuses) {
  return validateEnum(value, 'status', allowedStatuses);
}

export function validateRating(value) {
  const num = validateInteger(value, 'rating', { min: 1, max: 5 });
  return num;
}

export function validateUrl(value, fieldName = 'url') {
  const urlStr = String(value || '').trim();
  if (!urlStr) {
    throw createHttpError(400, `${fieldName} is required`);
  }
  try {
    new URL(urlStr);
    return urlStr;
  } catch {
    throw createHttpError(400, `Invalid ${fieldName}: must be a valid URL`);
  }
}

export function sanitizeHtml(value) {
  if (!value) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
