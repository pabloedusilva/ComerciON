/*
  Script: create_checkout_intents_tables.js
  Purpose: Create checkout_intents (pré-pagamento) e intent_items antes de gerar pedido real.
  Uso: node backend/scripts/create_checkout_intents_tables.js
*/
const { pool } = require('../src/config/database');

async function ensureCheckoutIntents(){
  await pool.query(`CREATE TABLE IF NOT EXISTS checkout_intents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    status ENUM('iniciada','link_gerado','paga','expirada','cancelada') NOT NULL DEFAULT 'iniciada',
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    address_json JSON NULL,
    coupon_code VARCHAR(50) NULL,
    txid VARCHAR(128) NULL,
    payment_provider VARCHAR(40) NULL,
    payment_received_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at DATETIME NULL,
    UNIQUE KEY uk_checkout_intents_txid (txid),
    KEY idx_checkout_user (user_id),
    CONSTRAINT fk_checkout_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  console.log('✔ Tabela checkout_intents ok');
}

async function ensureIntentItems(){
  await pool.query(`CREATE TABLE IF NOT EXISTS checkout_intent_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    intent_id INT NOT NULL,
    product_id INT NOT NULL,
    category VARCHAR(50) NOT NULL,
    size TINYINT NOT NULL DEFAULT 0,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    removed_ingredients VARCHAR(255) NULL,
    name_snapshot VARCHAR(255) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_intent_item_intent FOREIGN KEY (intent_id) REFERENCES checkout_intents(id) ON DELETE CASCADE,
    CONSTRAINT fk_intent_item_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  console.log('✔ Tabela checkout_intent_items ok');
}

async function main(){
  try {
    await ensureCheckoutIntents();
    await ensureIntentItems();
    console.log('\n✅ Tabelas de checkout intents prontas');
    process.exit(0);
  } catch (e) {
    console.error('❌ Falha ao criar tabelas de checkout intents:', e);
    process.exit(1);
  }
}
main();