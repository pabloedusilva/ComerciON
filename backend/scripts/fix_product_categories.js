// Corrige categorias em products: mapeia legacy para slugs válidos (produto/drink)
const { pool } = require('../src/config/database');

(async function main(){
  const map = new Map([
    ['pizza', 'produto'], ['pizzas', 'produto'], ['produto','produto'],
    ['drink','drink'], ['bebida','drink'], ['bebidas','drink']
  ]);
  try {
    const [rows] = await pool.query('SELECT id, category FROM products');
    let updates = 0;
    for (const r of rows) {
      const cur = String(r.category||'').toLowerCase();
      const next = map.get(cur) || cur || 'produto';
      if (next !== cur) {
        await pool.query('UPDATE products SET category=? WHERE id=?', [next, r.id]);
        updates++;
      }
    }
    console.log(`✅ Categorias de produtos normalizadas. Registros alterados: ${updates}`);
    process.exit(0);
  } catch (e) {
    console.error('❌ Erro ao ajustar categorias de products:', e);
    process.exit(1);
  }
})();
