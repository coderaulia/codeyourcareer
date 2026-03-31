-- Activity Log Table
-- Run this to add activity logging to existing databases

CREATE TABLE IF NOT EXISTS activity_log (
  id CHAR(36) NOT NULL PRIMARY KEY,
  admin_id CHAR(36) NULL,
  admin_email VARCHAR(255) NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NULL,
  resource_id CHAR(36) NULL,
  details TEXT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_activity_admin (admin_id),
  INDEX idx_activity_action (action),
  INDEX idx_activity_created (created_at),
  CONSTRAINT fk_activity_admin FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
);