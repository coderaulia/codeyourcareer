import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { query, one } from '../db.js';

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  throw new Error('Missing ADMIN_EMAIL or ADMIN_PASSWORD in the environment.');
}

const passwordHash = await bcrypt.hash(adminPassword, 12);
const existingUser = await one('SELECT id FROM admin_users WHERE email = ? LIMIT 1', [adminEmail]);

if (existingUser) {
  await query(
    'UPDATE admin_users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [passwordHash, existingUser.id]
  );
  console.log(`Updated admin user: ${adminEmail}`);
} else {
  await query(
    'INSERT INTO admin_users (id, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [randomUUID(), adminEmail, passwordHash, 'admin']
  );
  console.log(`Created admin user: ${adminEmail}`);
}
