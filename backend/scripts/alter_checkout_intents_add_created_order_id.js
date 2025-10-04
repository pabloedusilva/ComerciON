/*
  Script: alter_checkout_intents_add_created_order_id.js
  Purpose: Add created_order_id column to map intent -> pedido for idempotent successReturn.
  Usage: node backend/scripts/alter_checkout_intents_add_created_order_id.js
*/
const { pool } = require('../src/config/database');

async function run(){
  try {
    await pool.query(`ALTER TABLE checkout_intents ADD COLUMN created_order_id INT NULL AFTER txid`);
  } catch(e){
    if (e && e.code === 'ER_DUP_FIELDNAME') {
      console.log('Coluna created_order_id já existe.');
    } else {
      console.error('Erro ao adicionar coluna created_order_id:', e);
    }
  }
  try {
    await pool.query(`ALTER TABLE checkout_intents ADD UNIQUE KEY uk_checkout_created_order (created_order_id)`);
  } catch(e){
    // se índice já existe, ignorar
  }
  console.log('✅ Alteração concluída');
  process.exit(0);
}
run();
