import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { one, query } from './db.js';

export async function upsertAdminUser(email, password) {
  if (!email || !password) {
    throw new Error('Missing ADMIN_EMAIL or ADMIN_PASSWORD in the environment.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existingUser = await one('SELECT id FROM admin_users WHERE email = ? LIMIT 1', [email]);

  if (existingUser) {
    await query(
      'UPDATE admin_users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [passwordHash, existingUser.id]
    );

    return { action: 'updated', email };
  }

  await query(
    'INSERT INTO admin_users (id, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [randomUUID(), email, passwordHash, 'admin']
  );

  return { action: 'created', email };
}
