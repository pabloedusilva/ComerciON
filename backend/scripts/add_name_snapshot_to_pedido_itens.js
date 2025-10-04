/*
  Script: add_name_snapshot_to_pedido_itens.js
  Purpose: Add column name_snapshot to pedido_itens table if missing.
  Usage: node backend/scripts/add_name_snapshot_to_pedido_itens.js
*/

const { pool } = require('../src/config/database');

async function columnExists(table, column){
  const [rows] = await pool.query("SHOW COLUMNS FROM `"+table+"` LIKE ?", [column]);
  return rows && rows.length > 0;
}

async function ensureColumn(){
  const exists = await columnExists('pedido_itens', 'name_snapshot');
  if (exists) {
    console.log('• Coluna name_snapshot já existe em pedido_itens');
    return;
  }
  await pool.query("ALTER TABLE `pedido_itens` ADD COLUMN `name_snapshot` VARCHAR(255) NULL AFTER `unit_price`");
  console.log('✔ Coluna name_snapshot adicionada em pedido_itens');
}

async function main(){
  try {
    await ensureColumn();
    console.log('\n✅ Migração concluída');
    process.exit(0);
  } catch (err) {
    console.error('❌ Falha na migração:', err);
    process.exit(1);
  }
}

main();
