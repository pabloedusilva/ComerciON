/*
  Script: create_orders_tables.js
  Purpose: Create minimal orders and order_items tables, removable and safe to re-run.
  Usage: node backend/scripts/create_orders_tables.js
*/

const { pool } = require('../src/config/database');

async function ensureOrders() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pedido (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
  status ENUM('pendente','preparando','a_caminho','entregue','cancelado') NOT NULL DEFAULT 'pendente',
      subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
      delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
      discount DECIMAL(10,2) NOT NULL DEFAULT 0,
      total DECIMAL(10,2) NOT NULL DEFAULT 0,
      address_json JSON NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_pedido_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✔ Tabela pedido ok');
}

async function ensureOrderItems() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pedido_itens (
      id INT PRIMARY KEY AUTO_INCREMENT,
      order_id INT NOT NULL,
      product_id INT NOT NULL,
      category ENUM('pizza','drink') NOT NULL,
      size TINYINT NOT NULL DEFAULT 0,
      quantity INT NOT NULL DEFAULT 1,
      unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
      name_snapshot VARCHAR(255) NULL,
      removed_ingredients VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_pedidoitens_pedido FOREIGN KEY (order_id) REFERENCES pedido(id) ON DELETE CASCADE,
      CONSTRAINT fk_pedidoitens_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✔ Tabela pedido_itens ok');
}

async function main(){
  try {
    await ensureOrders();
    await ensureOrderItems();
    console.log('\n✅ Tabelas de pedidos prontas');
    process.exit(0);
  } catch (err) {
    console.error('❌ Falha ao criar tabelas de pedidos:', err);
    process.exit(1);
  }
}

main();
