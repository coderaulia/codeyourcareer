import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { query } from '../db.js';

async function seedSampleLinks() {
  const links = [
    {
      title: 'Book a Session',
      url: '#consultation',
      icon: 'bi-calendar-check',
      order: 0,
      active: true,
      type: 'internal',
      target: 'consultation',
      bg: '#eef2ff',
    },
    {
      title: 'Free Resources',
      url: '#freebies',
      icon: 'bi-download',
      order: 1,
      active: true,
      type: 'internal',
      target: 'freebies',
      bg: '#f5f7f8',
    },
    {
      title: 'Contact',
      url: '#contact',
      icon: 'bi-envelope',
      order: 2,
      active: true,
      type: 'internal',
      target: 'contact',
      bg: '#fff5f5',
    },
  ];

  for (const link of links) {
    const [existing] = await query('SELECT id FROM links WHERE title = ? LIMIT 1', [link.title]);
    if (existing) {
      console.log(`  Skipping link: ${link.title} (already exists)`);
      continue;
    }

    await query(
      `INSERT INTO links (id, title, url, icon, display_order, is_active, link_type, internal_target, style_bg)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), link.title, link.url, link.icon, link.order, link.active, link.type, link.target, link.bg]
    );
    console.log(`  Added link: ${link.title}`);
  }
}

async function seedSampleModules() {
  await query(`UPDATE modules SET is_enabled = TRUE WHERE slug = 'consultation'`);
  console.log('  Enabled module: Consultation Bookings');
}

async function seedSampleSiteSettings() {
  await query(
    `UPDATE site_settings SET
     site_name = 'My Career Site',
     headline = 'Welcome to My Career Site',
     subheadline = 'Your career journey starts here. Let me help you navigate the path to your dream job.',
     cta_title = 'Ready to take the next step?',
     cta_subtitle = 'Book a 1:1 session and lets decode your career together.',
     cta_button_text = 'Book a Consultation'
     WHERE id = 1`
  );
  console.log('  Updated site settings');
}

async function main() {
  console.log('\nSeeding minimal sample data...\n');

  const shouldSeed = process.argv.includes('--force');
  
  if (!shouldSeed) {
    const [existingLinks] = await query('SELECT COUNT(*) as count FROM links');
    if (existingLinks.count > 0) {
      console.log('Sample data already exists. Use --force to re-add anyway.\n');
      console.log('Aborted.');
      return;
    }
  }

  console.log('Adding sample links...');
  await seedSampleLinks();

  console.log('\nConfiguring modules...');
  await seedSampleModules();

  console.log('\nUpdating site settings...');
  await seedSampleSiteSettings();

  console.log('\nSample data seeded successfully.\n');
  console.log('You can now:');
  console.log('  - Visit your site to see the sample content');
  console.log('  - Login to /adminpanel to customize everything\n');
}

main().catch((error) => {
  console.error('\nSeeding failed:', error.message);
  process.exit(1);
});
