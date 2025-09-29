// Model Product - Pizzas e bebidas
const { pool } = require('../config/database');

const Product = {
  // removed: DDL function disabled to harden production
  async createTable() { return; },

  async listAll({ onlyActive = true } = {}) {
    const where = onlyActive ? 'WHERE status = "active"' : '';
    const [rows] = await pool.execute(`SELECT * FROM products ${where} ORDER BY id DESC`);
    return rows.map(Product._rowToEntity);
  },

  async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM products WHERE id = ?', [id]);
    return rows[0] ? Product._rowToEntity(rows[0]) : null;
  },

  async create(data) {
    const { name, category, description, price, img, status } = data;
    const [result] = await pool.execute(
      `INSERT INTO products (name, category, description, price_small, price_medium, price_large, img, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, category, description || '', price[0] || 0, price[1] || 0, price[2] || 0, img || null, status || 'active']
    );
    return await Product.findById(result.insertId);
  },

  async update(id, data) {
    const current = await Product.findById(id);
    if (!current) return null;
    const merged = {
      ...current,
      ...data,
      price: data.price || current.price
    };
    await pool.execute(
      `UPDATE products SET name=?, category=?, description=?, price_small=?, price_medium=?, price_large=?, img=?, status=? WHERE id=?`,
      [
        merged.name,
        merged.category,
        merged.description || '',
        merged.price[0] || 0,
        merged.price[1] || 0,
        merged.price[2] || 0,
        merged.img || null,
        merged.status || 'active',
        id
      ]
    );
    return await Product.findById(id);
  },

  async remove(id) {
    const [result] = await pool.execute('DELETE FROM products WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  _rowToEntity(row) {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      price: [Number(row.price_small), Number(row.price_medium), Number(row.price_large)],
      sizes: ['', '', ''],
      img: row.img,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
};

module.exports = Product;
// Model Product - Pizzas e bebidas