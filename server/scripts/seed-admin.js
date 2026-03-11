import 'dotenv/config';
import { upsertAdminUser } from '../admin-user.js';

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const result = await upsertAdminUser(adminEmail, adminPassword);

console.log(`${result.action === 'created' ? 'Created' : 'Updated'} admin user: ${result.email}`);
