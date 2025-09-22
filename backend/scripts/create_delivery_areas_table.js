// One-off script to create delivery_areas table
// Usage: node backend/scripts/create_delivery_areas_table.js

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../src/config/database');

async function run() {
  const createSql = `
    CREATE TABLE IF NOT EXISTS delivery_areas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      state_id INT NULL,
      state_name VARCHAR(100) NOT NULL,
      state_uf CHAR(2) NOT NULL,
      city_id INT NULL,
      city_name VARCHAR(150) NOT NULL,
      fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_state_city (state_uf, city_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    console.log('Creating table delivery_areas if not exists...');
    await pool.query(createSql);
    console.log('Done. No seed rows inserted (start with empty list).');
  } catch (err) {
    console.error('Failed to create table:', err);
  } finally {
    await pool.end();
  }
}

run();
