-- Hardening schema for authentication (idempotent)

-- Table to track login attempts
CREATE TABLE IF NOT EXISTS login_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(150) NULL,
  ip_address VARCHAR(64) NULL,
  sucesso TINYINT(1) NOT NULL DEFAULT 0,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_criado (email, criado_em),
  INDEX idx_ip_criado (ip_address, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Ensure sessoes has criado_em
SET @exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sessoes' AND COLUMN_NAME = 'criado_em');
SET @sql := IF(@exists = 0, 'ALTER TABLE sessoes ADD COLUMN criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ensure sessoes has ativo
SET @exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sessoes' AND COLUMN_NAME = 'ativo');
SET @sql := IF(@exists = 0, 'ALTER TABLE sessoes ADD COLUMN ativo TINYINT(1) NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ensure columns used by middleware exist and have proper sizes
ALTER TABLE sessoes 
  MODIFY COLUMN user_agent VARCHAR(300) NULL,
  MODIFY COLUMN ip_address VARCHAR(64) NULL;

-- Helpful index for user session operations
SET @exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sessoes' AND INDEX_NAME = 'idx_sessoes_user');
SET @sql := IF(@exists = 0, 'CREATE INDEX idx_sessoes_user ON sessoes(user_id, tipo_usuario)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
