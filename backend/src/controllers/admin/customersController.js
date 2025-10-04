// Gestão de clientes - Admin
const { pool } = require('../../config/database');

const safeUserRow = (row) => ({
  id: row.id,
  nome: row.nome,
  email: row.email,
  telefone: row.telefone,
  endereco: row.endereco,
  cidade: row.cidade,
  estado: row.estado,
  cep: row.cep,
  data_cadastro: row.data_cadastro,
  ativo: row.ativo === undefined ? undefined : !!row.ativo,
  // Agregados
  pedidos: Number(row.pedidos ?? 0),
  total_gasto: Number(row.total_gasto ?? 0),
  ultimo_pedido: row.ultimo_pedido || null
});

module.exports = {
  // GET /api/admin/customers
  async list(req, res) {
    try {
      const [rows] = await pool.execute(
        `SELECT u.id, u.nome, u.email, u.telefone, u.endereco, u.cidade, u.estado, u.cep, u.data_cadastro, u.ativo,
                COALESCE(o.pedidos, 0)        AS pedidos,
                COALESCE(o.total_gasto, 0.0)  AS total_gasto,
                o.ultimo_pedido               AS ultimo_pedido
         FROM usuarios u
         LEFT JOIN (
      SELECT user_id,
        SUM(CASE WHEN status NOT IN ('cancelado','pendente') THEN 1 ELSE 0 END) AS pedidos,
        SUM(CASE WHEN status NOT IN ('cancelado','pendente') THEN total ELSE 0 END) AS total_gasto,
        MAX(CASE WHEN status NOT IN ('cancelado','pendente') THEN created_at ELSE NULL END) AS ultimo_pedido
           FROM pedido
           GROUP BY user_id
         ) o ON o.user_id = u.id
         WHERE u.ativo = TRUE
         ORDER BY u.data_cadastro DESC`
      );

      const data = rows.map(safeUserRow);
      return res.json({ sucesso: true, data });
    } catch (error) {
      console.error('Erro ao listar clientes:', error);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar clientes' });
    }
  },

  // GET /api/admin/customers/:id
  async getById(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID inválido' });
      }
      const [rows] = await pool.execute(
        `SELECT u.id, u.nome, u.email, u.telefone, u.endereco, u.cidade, u.estado, u.cep, u.data_cadastro, u.ativo,
                COALESCE(o.pedidos, 0)        AS pedidos,
                COALESCE(o.total_gasto, 0.0)  AS total_gasto,
                o.ultimo_pedido               AS ultimo_pedido
         FROM usuarios u
         LEFT JOIN (
      SELECT user_id,
        SUM(CASE WHEN status NOT IN ('cancelado','pendente') THEN 1 ELSE 0 END) AS pedidos,
        SUM(CASE WHEN status NOT IN ('cancelado','pendente') THEN total ELSE 0 END) AS total_gasto,
        MAX(CASE WHEN status NOT IN ('cancelado','pendente') THEN created_at ELSE NULL END) AS ultimo_pedido
           FROM pedido
           GROUP BY user_id
         ) o ON o.user_id = u.id
         WHERE u.id = ? AND u.ativo = TRUE`,
        [id]
      );
      if (!rows || rows.length === 0) {
        return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado' });
      }
      return res.json({ sucesso: true, data: safeUserRow(rows[0]) });
    } catch (error) {
      console.error('Erro ao buscar cliente:', error);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar cliente' });
    }
  }
};
// Gestão de clientes