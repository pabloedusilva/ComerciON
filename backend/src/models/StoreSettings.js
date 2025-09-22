// Model StoreSettings - Configurações da loja (layout e informações públicas)
const { pool } = require('../config/database');

const DEFAULTS = {
	id: 1,
	logo_url: null,
	home_background_url: null,
	home_title: 'Pizzas 10% OFF',
	home_subtitle: 'Confira no cardápio',
	home_description: 'Sabor e qualidade com ingredientes selecionados.',
	carousel: [
		{ image_url: '/assets/images/default-images/banner1.jpg', caption: 'Clássicas irresistíveis' },
		{ image_url: '/assets/images/default-images/banner2.jpg', caption: 'Promoções da semana' }
	],
	instagram_enabled: 1,
	instagram_text: 'Siga-nos no Instagram',
	instagram_handle: 'pizzaria_deliciosa',
};

const StoreSettings = {
	async createTable() {
		const sql = `
			CREATE TABLE IF NOT EXISTS store_settings (
				id INT PRIMARY KEY,
				logo_url MEDIUMTEXT NULL,
				home_background_url MEDIUMTEXT NULL,
				home_title VARCHAR(255) NULL,
				home_subtitle VARCHAR(255) NULL,
				home_description TEXT NULL,
				carousel_json MEDIUMTEXT NULL,
				instagram_enabled TINYINT(1) NOT NULL DEFAULT 1,
				instagram_text VARCHAR(255) NULL,
				instagram_handle VARCHAR(100) NULL,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`;
		await pool.execute(sql);

		// Seed default row if empty
		const [rows] = await pool.execute('SELECT COUNT(*) as total FROM store_settings');
		if ((rows[0]?.total || 0) === 0) {
			await pool.execute(
				`INSERT INTO store_settings (id, logo_url, home_background_url, home_title, home_subtitle, home_description, carousel_json, instagram_enabled, instagram_text, instagram_handle)
				 VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					DEFAULTS.logo_url,
					DEFAULTS.home_background_url,
					DEFAULTS.home_title,
					DEFAULTS.home_subtitle,
					DEFAULTS.home_description,
					JSON.stringify(DEFAULTS.carousel),
					DEFAULTS.instagram_enabled,
					DEFAULTS.instagram_text,
					DEFAULTS.instagram_handle,
				]
			);
		}
	},

	async get() {
			// Garantir tabela existente
			try { await this.createTable(); } catch (_) {}
		const [rows] = await pool.execute('SELECT * FROM store_settings WHERE id = 1');
		if (!rows[0]) {
			return { ...DEFAULTS };
		}
		const r = rows[0];
		let carousel = DEFAULTS.carousel;
		try {
			carousel = r.carousel_json ? JSON.parse(r.carousel_json) : DEFAULTS.carousel;
		} catch (_) {}
		return {
			id: 1,
			logo_url: r.logo_url || DEFAULTS.logo_url,
			home_background_url: r.home_background_url || DEFAULTS.home_background_url,
			home_title: r.home_title || DEFAULTS.home_title,
			home_subtitle: r.home_subtitle || DEFAULTS.home_subtitle,
			home_description: r.home_description || DEFAULTS.home_description,
			carousel,
			instagram_enabled: Number(r.instagram_enabled ?? 1),
			instagram_text: r.instagram_text || DEFAULTS.instagram_text,
			instagram_handle: r.instagram_handle || DEFAULTS.instagram_handle,
			updated_at: r.updated_at,
			created_at: r.created_at,
		};
	},

	async update(partial) {
			try { await this.createTable(); } catch (_) {}
		const current = await this.get();
		const next = { ...current, ...partial };
		await pool.execute(
			`REPLACE INTO store_settings 
				(id, logo_url, home_background_url, home_title, home_subtitle, home_description, carousel_json, instagram_enabled, instagram_text, instagram_handle)
			 VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				next.logo_url || null,
				next.home_background_url || null,
				next.home_title || null,
				next.home_subtitle || null,
				next.home_description || null,
				JSON.stringify(next.carousel || []),
				Number(next.instagram_enabled ? 1 : 0),
				next.instagram_text || null,
				next.instagram_handle || null,
			]
		);
		return this.get();
	},
};

module.exports = StoreSettings;