/*
	Seed: cria tabelas mínimas e registra linhas base
	- Layout (id=1)
	- Settings (id=1)
	- delivery_areas (com unique em state_uf+city_name)

	Observação:
	- Não cria/insere pedidos. O endpoint de estatísticas funcionará, porém
		retornará vazio até existir uma tabela de pedidos real com entregas.
*/

const { pool } = require('../src/config/database');

async function ensureLayout() {
	await pool.query(`
		CREATE TABLE IF NOT EXISTS \`Layout\` (
			id INT PRIMARY KEY,
			logo_url VARCHAR(1024) NULL,
			home_background_url VARCHAR(1024) NULL,
			home_title VARCHAR(255) NULL,
			home_subtitle VARCHAR(255) NULL,
			home_description VARCHAR(1024) NULL,
			carousel_json LONGTEXT NULL,
			instagram_enabled TINYINT(1) DEFAULT 0,
			instagram_text VARCHAR(255) NULL,
			instagram_handle VARCHAR(255) NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`);
	const [rows] = await pool.query('SELECT id FROM `Layout` WHERE id = 1');
	if (!rows[0]) {
		await pool.query(
			'INSERT INTO `Layout` (id, logo_url, home_background_url, home_title, home_subtitle, home_description, carousel_json, instagram_enabled, instagram_text, instagram_handle) VALUES (1, NULL, NULL, NULL, NULL, NULL, ?, 0, NULL, NULL)',
			[JSON.stringify([])]
		);
		console.log('✔ Layout criado com id=1');
	} else {
		console.log('• Layout já existe');
	}
}

async function ensureSettings() {
	await pool.query(`
		CREATE TABLE IF NOT EXISTS \`Settings\` (
			id INT PRIMARY KEY,
			name VARCHAR(255) NULL,
			phone VARCHAR(64) NULL,
			email VARCHAR(255) NULL,
			address VARCHAR(512) NULL,
			notification_sound VARCHAR(1024) NULL,
			notification_enabled TINYINT(1) DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`);
	const [rows] = await pool.query('SELECT id FROM `Settings` WHERE id = 1');
	if (!rows[0]) {
		await pool.query(
			'INSERT INTO `Settings` (id, name, phone, email, address, notification_sound, notification_enabled) VALUES (1, NULL, NULL, NULL, NULL, NULL, 0)'
		);
		console.log('✔ Settings criado com id=1');
	} else {
		console.log('• Settings já existe');
	}
}

async function ensureDeliveryAreas() {
	await pool.query(`
		CREATE TABLE IF NOT EXISTS \`delivery_areas\` (
			id INT PRIMARY KEY AUTO_INCREMENT,
			state_id INT NULL,
			state_name VARCHAR(255) NOT NULL,
			state_uf VARCHAR(8) NOT NULL,
			city_id INT NULL,
			city_name VARCHAR(255) NOT NULL,
			fee DECIMAL(10,2) NOT NULL DEFAULT 0,
			active TINYINT(1) NOT NULL DEFAULT 1,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			UNIQUE KEY \`uk_state_city\` (state_uf, city_name)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`);
	console.log('✔ Tabela delivery_areas ok');
}

async function main() {
	try {
		await ensureLayout();
		await ensureSettings();
		await ensureDeliveryAreas();
		console.log('\n✅ Seed finalizado');
		process.exit(0);
	} catch (err) {
		console.error('❌ Seed falhou:', err);
		process.exit(1);
	}
}

main();