import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { one, query } from './db.js';

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export async function findAdminUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  return one(
    'SELECT id, email, password_hash, role FROM admin_users WHERE email = ? LIMIT 1',
    [normalizedEmail]
  );
}

export async function ensureAdminUser(email, password) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) {
    throw new Error('Missing ADMIN_EMAIL or ADMIN_PASSWORD in the environment.');
  }

  const existingUser = await findAdminUserByEmail(normalizedEmail);
  if (existingUser) {
    return { action: 'skipped', email: normalizedEmail };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await query(
    'INSERT INTO admin_users (id, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [randomUUID(), normalizedEmail, passwordHash, 'admin']
  );

  return { action: 'created', email: normalizedEmail };
}

export async function upsertAdminUser(email, password) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) {
    throw new Error('Missing ADMIN_EMAIL or ADMIN_PASSWORD in the environment.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existingUser = await findAdminUserByEmail(normalizedEmail);

  if (existingUser) {
    await query(
      'UPDATE admin_users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [passwordHash, existingUser.id]
    );

    return { action: 'updated', email: normalizedEmail };
  }

  await query(
    'INSERT INTO admin_users (id, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [randomUUID(), normalizedEmail, passwordHash, 'admin']
  );

  return { action: 'created', email: normalizedEmail };
}

export async function updateAdminPassword(userId, nextPassword) {
  const passwordHash = await bcrypt.hash(nextPassword, 12);
  await query(
    'UPDATE admin_users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [passwordHash, userId]
  );
}

export async function verifyAdminPassword(userId, password) {
  const adminUser = await one('SELECT password_hash FROM admin_users WHERE id = ? LIMIT 1', [userId]);
  if (!adminUser) {
    return false;
  }

  return bcrypt.compare(password, adminUser.password_hash);
}
