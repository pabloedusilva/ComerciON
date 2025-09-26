// Customer Reviews Controller
const Review = require('../../models/Review');
const { pool } = require('../../config/database');

module.exports = {
	// POST /api/customer/reviews
	async create(req, res) {
		try {
			const userId = req.usuario.id;
			const { order_id, rating, comment } = req.body || {};
			const oid = parseInt(order_id, 10);
			if (Number.isNaN(oid)) return res.status(400).json({ sucesso: false, mensagem: 'order_id inválido' });
				const r = Math.max(1, Math.min(5, parseInt(rating, 10)));
				if (!Number.isFinite(r)) return res.status(400).json({ sucesso: false, mensagem: 'Rating inválido' });
				const safeComment = comment ? String(comment).slice(0, 4000) : null;

			const [orders] = await pool.execute('SELECT id, status FROM pedido WHERE id = ? AND user_id = ?', [oid, userId]);
			if (!orders.length) return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado' });
			const order = orders[0];
			if (order.status !== 'entregue') return res.status(400).json({ sucesso: false, mensagem: 'Somente pedidos entregues podem ser avaliados' });

			const existing = await Review.findByUserAndOrder(userId, oid);
			if (existing) return res.status(400).json({ sucesso: false, mensagem: 'Este pedido já foi avaliado' });

			const created = await Review.create({ user_id: userId, order_id: oid, rating: r, comment: safeComment });
			res.status(201).json({ sucesso: true, data: created });
		} catch (error) {
			console.error('Erro ao criar avaliação:', error);
			res.status(500).json({ sucesso: false, mensagem: 'Erro ao criar avaliação' });
		}
	},

	// GET /api/customer/reviews
	async list(req, res) {
		try {
			const userId = req.usuario.id;
			const reviews = await Review.listByUser(userId);
			res.json({ sucesso: true, data: reviews });
		} catch (error) {
			console.error('Erro ao listar avaliações:', error);
			res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar avaliações' });
		}
	}
};