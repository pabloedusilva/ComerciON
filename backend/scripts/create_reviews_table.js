/*
  Script: create_reviews_table.js
  Purpose: Create the reviews table safely (idempotent) to support avaliações de pedidos.
  Usage: node backend/scripts/create_reviews_table.js
*/

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../src/config/database');

async function ensureReviews() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      order_id INT NOT NULL,
      product_id INT NULL,
      rating TINYINT NOT NULL,
      comment TEXT NULL,
      verified TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES pedido(id) ON DELETE CASCADE,
      CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
      CONSTRAINT uq_reviews_user_order UNIQUE (user_id, order_id),
      INDEX idx_reviews_order (order_id),
      INDEX idx_reviews_user (user_id),
      INDEX idx_reviews_rating (rating),
      INDEX idx_reviews_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✔ Tabela reviews ok');
}

async function main() {
  try {
    await ensureReviews();
    console.log('\n✅ Tabela de avaliações pronta');
    process.exit(0);
  } catch (err) {
    console.error('❌ Falha ao criar tabela reviews:', err);
    process.exit(1);
  }
}

main();
