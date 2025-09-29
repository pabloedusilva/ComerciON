const { pool } = require('../src/config/database');

async function run(){
  try {
    console.log('🔎 Verificando tipo da coluna pedido_itens.category');
    const [rows] = await pool.query("SHOW COLUMNS FROM `pedido_itens` LIKE 'category'");
    console.log(rows[0] || rows);
    console.log('✅ Ok. Tente criar um pedido via API para validar end-to-end.');
  } catch (e) {
    console.error('Erro no teste:', e);
  } finally {
    try { await pool.end(); } catch(_) {}
  }
}

if (require.main === module) run();
