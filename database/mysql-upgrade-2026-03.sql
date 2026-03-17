ALTER TABLE freebies
  ADD COLUMN IF NOT EXISTS image_url TEXT NULL AFTER link;

ALTER TABLE gear
  ADD COLUMN IF NOT EXISTS image_url TEXT NULL AFTER link;

ALTER TABLE testimonials
  ADD COLUMN IF NOT EXISTS image_url TEXT NULL AFTER rating;

ALTER TABLE contact_messages
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS session_version INT UNSIGNED NOT NULL DEFAULT 1 AFTER role;

UPDATE modules
SET name = 'Traffic Analytics',
    description = 'Track traffic sources, clicks, and conversions without third-party scripts.',
    icon = 'bi-bar-chart-line',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'analytics';

CREATE TABLE IF NOT EXISTS visitor_sessions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  landing_path VARCHAR(255) NOT NULL DEFAULT '/',
  last_path VARCHAR(255) NOT NULL DEFAULT '/',
  landing_referrer TEXT NULL,
  last_referrer TEXT NULL,
  referrer_host VARCHAR(255) NULL,
  utm_source VARCHAR(255) NULL,
  utm_medium VARCHAR(255) NULL,
  utm_campaign VARCHAR(255) NULL,
  utm_content VARCHAR(255) NULL,
  utm_term VARCHAR(255) NULL,
  source_label VARCHAR(255) NOT NULL DEFAULT 'direct',
  medium_label VARCHAR(255) NOT NULL DEFAULT 'direct',
  campaign_label VARCHAR(255) NULL,
  browser VARCHAR(120) NULL,
  os VARCHAR(120) NULL,
  device_type VARCHAR(40) NULL,
  country_code VARCHAR(8) NULL,
  is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_visitor_sessions_started_at (started_at),
  INDEX idx_visitor_sessions_source (source_label, medium_label, started_at),
  INDEX idx_visitor_sessions_campaign (campaign_label, started_at)
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  session_id CHAR(36) NOT NULL,
  event_type VARCHAR(60) NOT NULL,
  page_path VARCHAR(255) NULL,
  link_id CHAR(36) NULL,
  link_title VARCHAR(255) NULL,
  resource_table VARCHAR(40) NULL,
  resource_id CHAR(36) NULL,
  resource_title VARCHAR(255) NULL,
  booking_id CHAR(36) NULL,
  contact_message_id CHAR(36) NULL,
  source_label VARCHAR(255) NOT NULL DEFAULT 'direct',
  medium_label VARCHAR(255) NOT NULL DEFAULT 'direct',
  campaign_label VARCHAR(255) NULL,
  metadata_json LONGTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_analytics_events_session FOREIGN KEY (session_id) REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  INDEX idx_analytics_events_created_at (created_at),
  INDEX idx_analytics_events_type_created_at (event_type, created_at),
  INDEX idx_analytics_events_session_type (session_id, event_type, created_at)
);
