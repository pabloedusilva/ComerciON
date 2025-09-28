// Atualiza/garante schema de categorias e sincroniza produtos
const { pool } = require('../src/config/database');
const Category = require('../src/models/Category');

(async function main(){
  try {
    await Category.createTable();
    await Category.ensureDefaults();
    // Normalizar produtos existentes
    const map = new Map([
      ['pizza', 'produto'], ['pizzas', 'produto'], ['produto','produto'],
      ['drink','drink'], ['bebida','drink'], ['bebidas','drink']
    ]);
    const [rows] = await pool.query('SELECT id, category FROM products');
    for (const r of rows) {
      const cur = String(r.category||'').toLowerCase();
      const next = map.get(cur) || cur || 'produto';
      if (next !== cur) {
        await pool.query('UPDATE products SET category=? WHERE id=?', [next, r.id]);
      }
    }
    console.log('✅ Categorias atualizadas e produtos normalizados');
    process.exit(0);
  } catch (e) {
    console.error('❌ Erro ao atualizar schema de categorias:', e);
    process.exit(1);
  }
})();
