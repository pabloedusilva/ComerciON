/**
 * Migrate pedido_itens.category to support custom categories (free-form slug)
 * - Changes column type from ENUM('pizza','drink') to VARCHAR(50) NOT NULL
 * - Safe to run multiple times (no-op if already VARCHAR)
 */
const { pool } = require('../src/config/database');

async function getColumnType(table, column){
  const [rows] = await pool.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
  if (!rows || !rows.length) return null;
  return String(rows[0].Type || rows[0].type || '').toLowerCase();
}

async function tableExists(name){
  try {
    await pool.query(`SELECT 1 FROM \`${name}\` LIMIT 1`);
    return true;
  } catch (_) { return false; }
}

async function main(){
  try {
    console.log('🔧 Migrando coluna pedido_itens.category para VARCHAR(50)...');
    const exists = await tableExists('pedido_itens');
    if (!exists) {
      console.log('⚠ Tabela pedido_itens não existe. Nada a migrar.');
      process.exit(0);
    }
    const type = await getColumnType('pedido_itens','category');
    if (!type) {
      console.log('⚠ Coluna category não encontrada em pedido_itens. Nada a migrar.');
      process.exit(0);
    }
    if (type.includes('varchar')) {
      console.log('✔ Coluna category já é VARCHAR. Nenhuma alteração necessária.');
      process.exit(0);
    }
    // Alterar coluna para VARCHAR(50)
    await pool.query(`ALTER TABLE \`pedido_itens\` MODIFY COLUMN \`category\` VARCHAR(50) NOT NULL`);
    console.log('✅ Coluna category migrada para VARCHAR(50) com sucesso.');
  } catch (err) {
    console.error('❌ Falha ao migrar coluna category:', err);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch(_) {}
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
