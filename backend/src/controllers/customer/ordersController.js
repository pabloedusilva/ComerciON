const { pool } = require('../../config/database');
const Product = require('../../models/Product');

function computeTotals(items) {
  const entrega = 5.0;
  const pizzasValor = items.reduce((acc, it) => acc + (it.unit_price * it.quantity), 0);
  const subtotal = pizzasValor + entrega;
  const desconto = subtotal * 0.10;
  const total = subtotal - desconto;
  return { subtotal, entrega, desconto, total };
}

module.exports = {
  // POST /api/customer/orders
  create: async (req, res) => {
    try {
      const user = req.usuario;
      const body = req.body || {};
      const items = Array.isArray(body.items) ? body.items : [];
      if (items.length === 0) {
        return res.status(400).json({ sucesso: false, mensagem: 'Itens do pedido são obrigatórios' });
      }

      // Normalize and validate items; compute unit_price from DB
      const preparedItems = [];
      for (const it of items) {
        const id = parseInt(it.id, 10);
        const size = parseInt(it.size, 10);
        const quantity = parseInt(it.qt || it.quantity || 0, 10);
        const category = (it.type === 'drink' || it.category === 'drink') ? 'drink' : 'pizza';
        const removed = (it.removedIngredients || '').toString().slice(0, 200) || null;
        if (!id || !Number.isFinite(size) || size < 0 || size > 2 || !quantity || quantity < 1) {
          return res.status(400).json({ sucesso: false, mensagem: 'Item inválido' });
        }
        const product = await Product.findById(id);
        if (!product) return res.status(400).json({ sucesso: false, mensagem: 'Produto não encontrado' });
        if (product.status && product.status !== 'active') return res.status(400).json({ sucesso: false, mensagem: 'Produto inativo' });
        const unitPrice = Array.isArray(product.price) ? Number(product.price[size]) : Number(product.price?.[size]);
        if (!Number.isFinite(unitPrice)) return res.status(400).json({ sucesso: false, mensagem: 'Preço inválido para o produto' });
        preparedItems.push({
          product_id: id,
          category,
          size,
          quantity,
          unit_price: unitPrice,
          removed_ingredients: removed,
          name_snapshot: product.name
        });
      }

      const totals = computeTotals(preparedItems);

      // Address snapshot from user profile
      const addr = {
        nome: user.nome,
        telefone: user.telefone || null,
        endereco: user.endereco || null,
        cidade: user.cidade || null,
        estado: user.estado || null,
        cep: user.cep || null
      };

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [orderRes] = await conn.execute(
          `INSERT INTO pedido (user_id, status, subtotal, delivery_fee, discount, total, address_json, created_at)
           VALUES (?, 'pendente', ?, ?, ?, ?, ?, NOW())`,
          [user.id, totals.subtotal, totals.entrega, totals.desconto, totals.total, JSON.stringify(addr)]
        );
        const orderId = orderRes.insertId;

        const insertValues = [];
        const placeholders = [];
        for (const it of preparedItems) {
          placeholders.push('(?,?,?,?,?,?,?)');
          insertValues.push(orderId, it.product_id, it.category, it.size, it.quantity, it.unit_price, it.removed_ingredients);
        }
        await conn.execute(
          `INSERT INTO pedido_itens (order_id, product_id, category, size, quantity, unit_price, removed_ingredients)
           VALUES ${placeholders.join(',')}`,
          insertValues
        );

        await conn.commit();

        // Emitir evento de novo pedido para admin em tempo real
        try {
          const io = req.app?.get('io');
          if (io && typeof io.emitOrderCreated === 'function') {
            io.emitOrderCreated({ id: orderId });
          }
        } catch (_) { /* noop */ }

        return res.json({ sucesso: true, data: { id: orderId, totals } });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error('Erro ao criar pedido:', error);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao criar pedido' });
    }
  },

  // GET /api/customer/orders
  list: async (req, res) => {
    try {
      const userId = req.usuario.id;
      const [orders] = await pool.execute(
        `SELECT id, status, subtotal, delivery_fee, discount, total, address_json, created_at
         FROM pedido WHERE user_id = ? ORDER BY created_at DESC`, [userId]
      );

      const ids = orders.map(o => o.id);
      let itemsByOrder = {};
      if (ids.length > 0) {
        const [items] = await pool.query(
          `SELECT order_id, product_id, category, size, quantity, unit_price, removed_ingredients
           FROM pedido_itens WHERE order_id IN (${ids.map(()=>'?').join(',')})`, ids
        );
        for (const it of items) {
          (itemsByOrder[it.order_id] = itemsByOrder[it.order_id] || []).push(it);
        }
      }
      const data = orders.map(o => ({ ...o, items: itemsByOrder[o.id] || [] }));
      return res.json({ sucesso: true, data });
    } catch (error) {
      console.error('Erro ao listar pedidos:', error);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar pedidos' });
    }
  },

  // GET /api/customer/orders/:id
  getById: async (req, res) => {
    try {
      const userId = req.usuario.id;
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ sucesso: false, mensagem: 'ID inválido' });
      const [orders] = await pool.execute(
        `SELECT id, status, subtotal, delivery_fee, discount, total, address_json, created_at
         FROM pedido WHERE id = ? AND user_id = ?`, [id, userId]
      );
      if (!orders || orders.length === 0) return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado' });
      const order = orders[0];
      const [items] = await pool.execute(
        `SELECT order_id, product_id, category, size, quantity, unit_price, removed_ingredients
         FROM pedido_itens WHERE order_id = ?`, [id]
      );
      return res.json({ sucesso: true, data: { ...order, items } });
    } catch (error) {
      console.error('Erro ao obter pedido:', error);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao obter pedido' });
    }
  }
};
// Pedidos do cliente