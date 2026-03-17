import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { one, query, transaction } from './db.js';

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export async function findAdminUserByEmail(email, executor = { one }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  return executor.one(
    'SELECT id, email, password_hash, role, session_version FROM admin_users WHERE email = ? LIMIT 1',
    [normalizedEmail]
  );
}

export async function findAdminUserById(userId, executor = { one }) {
  if (!userId) {
    return null;
  }

  return executor.one(
    'SELECT id, email, role, session_version FROM admin_users WHERE id = ? LIMIT 1',
    [userId]
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
    'INSERT INTO admin_users (id, email, password_hash, role, session_version) VALUES (?, ?, ?, ?, ?)',
    [randomUUID(), normalizedEmail, passwordHash, 'admin', 1]
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
    'INSERT INTO admin_users (id, email, password_hash, role, session_version) VALUES (?, ?, ?, ?, ?)',
    [randomUUID(), normalizedEmail, passwordHash, 'admin', 1]
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

export async function rotateAdminSession(userId, executor = { query, one }) {
  await executor.query(
    'UPDATE admin_users SET session_version = session_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [userId]
  );

  const updatedUser = await executor.one(
    'SELECT session_version FROM admin_users WHERE id = ? LIMIT 1',
    [userId]
  );

  return Number(updatedUser?.session_version || 1);
}

export async function updatePasswordAndRotateSession(userId, nextPassword) {
  return transaction(async (helpers) => {
    const passwordHash = await bcrypt.hash(nextPassword, 12);
    await helpers.query(
      `UPDATE admin_users
       SET password_hash = ?,
           session_version = session_version + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [passwordHash, userId]
    );

    const updatedUser = await helpers.one(
      'SELECT session_version FROM admin_users WHERE id = ? LIMIT 1',
      [userId]
    );

    return Number(updatedUser?.session_version || 1);
  });
}

export async function verifyAdminPassword(userId, password) {
  const adminUser = await one(
    'SELECT password_hash FROM admin_users WHERE id = ? LIMIT 1',
    [userId]
  );
  if (!adminUser) {
    return false;
  }

  return bcrypt.compare(password, adminUser.password_hash);
}
