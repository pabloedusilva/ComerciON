// Avaliações e reviews
const Review = require('../../models/Review');
const { pool } = require('../../config/database');

const adminReviewsController = {
	// GET /api/admin/reviews
	async list(req, res) {
		try {
			const { q, rating } = req.query || {};
			const limit = Math.min(Math.max(parseInt(req.query.limit,10)||50,1),200);
			const offset = Math.max(parseInt(req.query.offset,10)||0,0);
			const filters = { search: q, rating, limit, offset };
			const [reviews, total, avg] = await Promise.all([
				Review.listAll(filters),
				Review.countAll(filters),
				Review.averageRating()
			]);
			res.json({
				sucesso: true,
				data: {
					reviews,
					average: avg,
					pagination: { total, limit, offset, count: reviews.length }
				}
			});
		} catch (error) {
			console.error('Erro ao listar avaliações:', error);
			res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar avaliações' });
		}
	},

	// DELETE /api/admin/reviews/:id (opcional moderação)
	async remove(req, res) {
		try {
			const id = parseInt(req.params.id, 10);
			if (Number.isNaN(id)) return res.status(400).json({ sucesso: false, mensagem: 'ID inválido' });
			const ok = await Review.remove(id);
			if (!ok) return res.status(404).json({ sucesso: false, mensagem: 'Avaliação não encontrada' });
			res.json({ sucesso: true });
		} catch (error) {
			console.error('Erro ao remover avaliação:', error);
			res.status(500).json({ sucesso: false, mensagem: 'Erro ao remover avaliação' });
		}
	}
};

module.exports = adminReviewsController;