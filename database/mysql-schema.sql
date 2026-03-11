CREATE TABLE IF NOT EXISTS site_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  site_name VARCHAR(255) NOT NULL DEFAULT 'CodeYourCareer.my.id',
  headline VARCHAR(255) NOT NULL DEFAULT 'Welcome to CodeYourCareer',
  subheadline TEXT,
  footer_text VARCHAR(255) NOT NULL DEFAULT '© 2026 CodeYourCareer. All rights reserved.',
  logo_type VARCHAR(20) NOT NULL DEFAULT 'svg',
  logo_svg MEDIUMTEXT,
  logo_image_url TEXT NULL,
  logo_emoji VARCHAR(16) NULL,
  bg_color VARCHAR(20) NOT NULL DEFAULT '#f8f9fa',
  text_color VARCHAR(20) NOT NULL DEFAULT '#111111',
  text_secondary VARCHAR(20) NOT NULL DEFAULT '#555555',
  accent_color VARCHAR(20) NOT NULL DEFAULT '#000000',
  card_bg VARCHAR(20) NOT NULL DEFAULT '#ffffff',
  card_border VARCHAR(20) NOT NULL DEFAULT '#e0e0e0',
  cta_bg VARCHAR(20) NOT NULL DEFAULT '#111111',
  cta_text VARCHAR(20) NOT NULL DEFAULT '#ffffff',
  cta_btn_bg VARCHAR(20) NOT NULL DEFAULT '#ffffff',
  cta_btn_text VARCHAR(20) NOT NULL DEFAULT '#000000',
  cta_title VARCHAR(255) NOT NULL DEFAULT 'Ready to debug your career?',
  cta_subtitle VARCHAR(255) NOT NULL DEFAULT '1:1 Session for Students, Job Seekers & Professionals.',
  cta_button_text VARCHAR(255) NOT NULL DEFAULT 'Mulai Konsultasi Karir Sekarang!',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO site_settings (id, subheadline, logo_svg, logo_emoji)
VALUES (
  1,
  'Every career has a code, and once you learn to decode it, you can build the future you want.',
  '<svg viewBox="0 0 100 100" fill="none"><rect x="5" y="5" width="90" height="90" rx="20" fill="black"/><path d="M35 30 L25 50 L35 70" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M65 30 L75 50 L65 70" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M50 65 L50 35 M50 35 L40 45 M50 35 L60 45" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  '??'
)
ON DUPLICATE KEY UPDATE id = id;

CREATE TABLE IF NOT EXISTS modules (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  description TEXT NULL,
  icon VARCHAR(80) NOT NULL DEFAULT 'bi-puzzle',
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO modules (id, name, slug, description, icon, is_enabled, display_order) VALUES
('a7d3582f-a18c-45cb-9cd9-2f91ce947ec1', 'Consultation Bookings', 'consultation', 'Allow visitors to book 1:1 sessions.', 'bi-calendar-check', TRUE, 1),
('0f4a6924-0ebd-4d73-a531-2195e9304e8f', 'Testimonials', 'testimonials', 'Display client testimonials and social proof.', 'bi-chat-quote', FALSE, 2),
('317d0f50-4bb2-4ee6-9cdc-874f82279f49', 'Contact Form', 'contact', 'Simple contact form for visitor inquiries.', 'bi-envelope', FALSE, 3),
('ee786f3f-cfce-4301-a4f3-0d36ef1b37f0', 'Link Analytics', 'analytics', 'Track link clicks to understand your audience.', 'bi-bar-chart-line', FALSE, 4)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  icon = VALUES(icon),
  display_order = VALUES(display_order);

CREATE TABLE IF NOT EXISTS links (
  id CHAR(36) NOT NULL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  icon VARCHAR(80) NOT NULL DEFAULT 'bi-link-45deg',
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  link_type VARCHAR(30) NOT NULL DEFAULT 'external',
  internal_target VARCHAR(80) NULL,
  style_bg VARCHAR(40) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS freebies (
  id CHAR(36) NOT NULL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  link TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gear (
  id CHAR(36) NOT NULL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(255) NULL,
  link TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  topic VARCHAR(255) NOT NULL,
  schedule DATETIME NOT NULL,
  meetlink TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS testimonials (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(255) NULL,
  content TEXT NOT NULL,
  rating TINYINT UNSIGNED NOT NULL DEFAULT 5,
  is_featured BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS link_clicks (
  id CHAR(36) NOT NULL PRIMARY KEY,
  link_id CHAR(36) NULL,
  link_title VARCHAR(255) NULL,
  clicked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_link_clicks_link FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
