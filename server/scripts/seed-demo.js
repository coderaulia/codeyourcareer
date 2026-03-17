import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { query } from '../db.js';

async function ensureDemoLink(title, values) {
  const [link] = await query('SELECT id FROM links WHERE title = ? LIMIT 1', [title]);
  if (link) {
    return;
  }

  await query(
    `INSERT INTO links (id, title, url, icon, display_order, is_active, link_type, internal_target, style_bg)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values
  );
}

async function ensureDemoResource(table, title, values) {
  const rows = await query(`SELECT id FROM ${table} WHERE title = ? LIMIT 1`, [title]);
  if (rows[0]) {
    return;
  }

  if (table === 'freebies') {
    await query(
      'INSERT INTO freebies (id, title, description, link, image_url, display_order) VALUES (?, ?, ?, ?, ?, ?)',
      values
    );
    return;
  }

  await query(
    'INSERT INTO gear (id, title, category, link, image_url, display_order) VALUES (?, ?, ?, ?, ?, ?)',
    values
  );
}

async function ensureDemoTestimonial(name, values) {
  const [row] = await query('SELECT id FROM testimonials WHERE name = ? LIMIT 1', [name]);
  if (row) {
    return;
  }

  await query(
    `INSERT INTO testimonials (id, name, role, content, rating, image_url, is_featured, display_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    values
  );
}

await ensureDemoLink('Career Consultation', [
  randomUUID(),
  'Career Consultation',
  '#consultation',
  'bi-calendar-check',
  0,
  1,
  'internal',
  'consultation',
  '#eef2ff',
]);

await ensureDemoLink('Freebies', [
  randomUUID(),
  'Freebies',
  '#freebies',
  'bi-download',
  1,
  1,
  'internal',
  'freebies',
  '#f5f7f8',
]);

await ensureDemoResource('freebies', 'Career Audit Worksheet', [
  randomUUID(),
  'Career Audit Worksheet',
  'A practical worksheet to map your current position, target role, and next steps.',
  'https://example.com/career-audit',
  null,
  0,
]);

await ensureDemoResource('gear', 'USB Microphone', [
  randomUUID(),
  'USB Microphone',
  'Interview setup',
  'https://example.com/usb-microphone',
  null,
  0,
]);

await ensureDemoTestimonial('Alya Putri', [
  randomUUID(),
  'Alya Putri',
  'Product Designer',
  'The consultation gave me a clear plan and much better interview stories.',
  5,
  null,
  1,
  0,
]);

console.log('Demo data seeded successfully.');
