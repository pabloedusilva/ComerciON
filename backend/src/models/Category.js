// Model Category - Categorias de produtos
const { pool } = require('../config/database');

const normalizeSlug = (s) => String(s||'')
	.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
	.toLowerCase().trim()
	.replace(/[^a-z0-9_-\s]/g,'')
	.replace(/\s+/g,'-');

const Category = {
	async createTable() {
		const sql = `CREATE TABLE IF NOT EXISTS categories (
			id INT AUTO_INCREMENT PRIMARY KEY,
			slug VARCHAR(50) NOT NULL UNIQUE,
			title VARCHAR(100) NOT NULL,
			position INT NOT NULL DEFAULT 0,
			active TINYINT(1) NOT NULL DEFAULT 1,
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
		await pool.execute(sql);
	},

	async ensureDefaults() {
		// Seed categorias padrão se vazio
		const [rows] = await pool.execute('SELECT COUNT(*) as c FROM categories');
		if ((rows[0]?.c || 0) === 0) {
			await pool.execute('INSERT INTO categories (slug, title, position, active) VALUES (?, ?, ?, 1)', ['produto', 'Produtos', 1]);
			await pool.execute('INSERT INTO categories (slug, title, position, active) VALUES (?, ?, ?, 1)', ['drink', 'Bebidas', 2]);
		}
	},

	async listPublic() {
		const [rows] = await pool.execute('SELECT slug, title, position FROM categories WHERE active=1 ORDER BY position ASC, id ASC');
		return rows;
	},

	async listAll() {
		const [rows] = await pool.execute('SELECT id, slug, title, position, active, created_at, updated_at FROM categories ORDER BY position ASC, id ASC');
		return rows;
	},

	async findBySlug(slug) {
		const [rows] = await pool.execute('SELECT id, slug, title, position, active FROM categories WHERE slug=?', [slug]);
		return rows[0] || null;
	},

	async create({ slug, title, position, active = 1 }) {
		const s = normalizeSlug(slug || title);
		if (!s) throw new Error('Slug inválido');
		const t = String(title||'').trim();
		if (!t) throw new Error('Título inválido');
		const pos = Number.isFinite(Number(position)) ? Number(position) : 0;
		const [result] = await pool.execute('INSERT INTO categories (slug, title, position, active) VALUES (?, ?, ?, ?)', [s, t, pos, active?1:0]);
		return this.findBySlug(s);
	},

	async update(slug, data) {
		const current = await this.findBySlug(slug);
		if (!current) return null;
		const t = (data.title != null) ? String(data.title).trim() : current.title;
		const pos = (data.position != null) ? Number(data.position) : current.position;
		const act = (data.active != null) ? (data.active?1:0) : current.active;
		await pool.execute('UPDATE categories SET title=?, position=?, active=? WHERE slug=?', [t, pos, act, slug]);
		return this.findBySlug(slug);
	},

	async remove(slug) {
		const [res] = await pool.execute('DELETE FROM categories WHERE slug=?', [slug]);
		return res.affectedRows > 0;
	},

	normalizeSlug
};

module.exports = Category;