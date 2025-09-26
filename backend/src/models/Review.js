// Model Review - Avaliações de pedidos
const { pool } = require('../config/database');

const sanitizeRating = (r) => {
	const n = Number(r);
	if (!Number.isFinite(n)) return null;
	if (n < 1) return 1;
	if (n > 5) return 5;
	return Math.round(n);
};

const Review = {
	async create({ user_id, order_id, rating, comment, product_id = null }) {
		const r = sanitizeRating(rating);
		if (!r) throw new Error('Rating inválido');
		const safeComment = comment ? String(comment).slice(0, 4000) : null;
		const [res] = await pool.execute(
			`INSERT INTO reviews (user_id, order_id, product_id, rating, comment, created_at)
			 VALUES (?,?,?,?,?, NOW())`,
			[user_id, order_id, product_id, r, safeComment]
		);
		return await Review.findById(res.insertId);
	},

	async update(id, { rating, comment }) {
		const current = await Review.findById(id);
		if (!current) return null;
		const r = rating != null ? sanitizeRating(rating) : current.rating;
		const safeComment = comment != null ? String(comment).slice(0, 4000) : current.comment;
		await pool.execute(`UPDATE reviews SET rating=?, comment=? WHERE id=?`, [r, safeComment, id]);
		return await Review.findById(id);
	},

	async remove(id) {
		const [res] = await pool.execute('DELETE FROM reviews WHERE id = ?', [id]);
		return res.affectedRows > 0;
	},

	async findById(id) {
		const [rows] = await pool.execute(
			`SELECT r.*, u.nome as user_name
			 FROM reviews r JOIN usuarios u ON u.id = r.user_id
			 WHERE r.id = ?`, [id]
		);
		return rows[0] ? Review._row(rows[0]) : null;
	},

	async findByUserAndOrder(userId, orderId) {
		const [rows] = await pool.execute('SELECT * FROM reviews WHERE user_id = ? AND order_id = ?', [userId, orderId]);
		return rows[0] || null;
	},

	async listAll({ search, rating, limit = 100, offset = 0 } = {}) {
		const where = [];
		const params = [];
		const r = Number(rating);
		if (Number.isFinite(r) && r >= 1 && r <= 5) {
			where.push('r.rating = ?');
			params.push(r);
		}
		if (search) {
			const s = `%${String(search).toLowerCase()}%`;
			where.push('(LOWER(u.nome) LIKE ? OR LOWER(r.comment) LIKE ?)');
			params.push(s, s);
		}
		const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
		// Sanitiza limit/offset e impede SQL injection (sem interpolação de usuário cru)
		const l = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
		const o = Math.max(parseInt(offset, 10) || 0, 0);
		const sql = `SELECT r.*, u.nome as user_name
			FROM reviews r JOIN usuarios u ON u.id = r.user_id
			${whereSql}
			ORDER BY r.created_at DESC
			LIMIT ${l} OFFSET ${o}`;
		const [rows] = await pool.execute(sql, params);
		return rows.map(Review._row);
	},

	async countAll({ search, rating } = {}) {
		const where = [];
		const params = [];
		const r = Number(rating);
		if (Number.isFinite(r) && r >= 1 && r <= 5) {
			where.push('r.rating = ?');
			params.push(r);
		}
		if (search) {
			const s = `%${String(search).toLowerCase()}%`;
			where.push('(LOWER(u.nome) LIKE ? OR LOWER(r.comment) LIKE ?)');
			params.push(s, s);
		}
		const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
		const [rows] = await pool.execute(`SELECT COUNT(*) as total FROM reviews r JOIN usuarios u ON u.id = r.user_id ${whereSql}`, params);
		return Number(rows[0]?.total || 0);
	},

	async listByUser(userId) {
		const [rows] = await pool.execute(
			`SELECT r.*, u.nome as user_name
			 FROM reviews r JOIN usuarios u ON u.id = r.user_id
			 WHERE r.user_id = ? ORDER BY r.created_at DESC`, [userId]
		);
		return rows.map(Review._row);
	},

	async averageRating() {
		try {
			const [[row]] = await pool.query('SELECT COALESCE(AVG(rating),0) as media FROM reviews');
			return Number(row.media || 0);
		} catch (_) { return 0; }
	},

	_row(row) {
		return {
			id: row.id,
			user_id: row.user_id,
			user_name: row.user_name,
			order_id: row.order_id,
			product_id: row.product_id,
			rating: Number(row.rating),
			comment: row.comment,
			verified: !!row.verified,
			created_at: row.created_at,
			updated_at: row.updated_at
		};
	}
};

module.exports = Review;