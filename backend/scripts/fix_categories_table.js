// Ajusta tabela de categorias: remove colunas antigas (display_name, icon), garante colunas atuais
const { pool } = require('../src/config/database');
const Category = require('../src/models/Category');

(async function main(){
	const conn = await pool.getConnection();
	try {
		await conn.beginTransaction();
		// Criar tabela se não existir
		await Category.createTable();
		// Verificar colunas existentes
		const [cols] = await conn.query("SHOW COLUMNS FROM categories");
		const colNames = new Set(cols.map(c=>c.Field));

		// Remover colunas antigas se existirem
		if (colNames.has('display_name')) {
			await conn.query('ALTER TABLE categories DROP COLUMN display_name');
			console.log('🧹 Removida coluna display_name de categories');
			colNames.delete('display_name');
		}
		if (colNames.has('icon')) {
			await conn.query('ALTER TABLE categories DROP COLUMN icon');
			console.log('🧹 Removida coluna icon de categories');
			colNames.delete('icon');
		}

		// Adicionar colunas ausentes
		if (!colNames.has('title')) {
			await conn.query('ALTER TABLE categories ADD COLUMN title VARCHAR(100) NOT NULL DEFAULT ""');
			console.log('➕ Adicionada coluna title');
			colNames.add('title');
		}
		if (!colNames.has('slug')) {
			await conn.query('ALTER TABLE categories ADD COLUMN slug VARCHAR(50)');
			console.log('➕ Adicionada coluna slug');
			colNames.add('slug');
		}
		if (!colNames.has('position')) {
			await conn.query('ALTER TABLE categories ADD COLUMN position INT NOT NULL DEFAULT 0');
			console.log('➕ Adicionada coluna position');
			colNames.add('position');
		}
		if (!colNames.has('active')) {
			await conn.query('ALTER TABLE categories ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1');
			console.log('➕ Adicionada coluna active');
			colNames.add('active');
		}

		// Backfill de title a partir de 'name' caso exista coluna antiga 'name'
		const hasName = cols.some(c=>c.Field==='name');
		if (hasName) {
			await conn.query('UPDATE categories SET title = CASE WHEN (title IS NULL OR title="") THEN name ELSE title END');
			// Após backfill, remover coluna legada 'name' para evitar erros de NOT NULL sem default
			try {
				await conn.query('ALTER TABLE categories DROP COLUMN name');
				console.log('🧹 Removida coluna name de categories');
				// Atualizar colNames para refletir remoção
				colNames.delete('name');
			} catch (err) {
				console.warn('Aviso: não foi possível remover coluna name, tentando torná-la NULL:', err.message);
				try {
					await conn.query('ALTER TABLE categories MODIFY COLUMN name VARCHAR(100) NULL DEFAULT NULL');
					console.log('🔧 Coluna name ajustada para permitir NULL');
				} catch (err2) {
					console.warn('Aviso: falha ao ajustar coluna name para NULL:', err2.message);
				}
			}
		}

		// Popular slug a partir de title caso esteja null
		const [rows] = await conn.query('SELECT id, slug, title FROM categories');
		const toUpdate = [];
		const seen = new Set();
		const norm = (s)=> String(s||'')
				.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
				.toLowerCase().trim().replace(/[^a-z0-9_-\s]/g,'').replace(/\s+/g,'-') || 'categoria';
		for (const r of rows) {
			let s = r.slug && String(r.slug).trim() ? String(r.slug).trim() : norm(r.title);
			let base = s; let i = 1;
			while (seen.has(s)) { s = `${base}-${i++}`; }
			seen.add(s);
			if (s !== r.slug) toUpdate.push([s, r.id]);
		}
		for (const [s, id] of toUpdate) {
			await conn.query('UPDATE categories SET slug=? WHERE id=?', [s, id]);
		}

		// Garantir NOT NULL e UNIQUE em slug
		await conn.query('ALTER TABLE categories MODIFY COLUMN slug VARCHAR(50) NOT NULL');
		try { await conn.query('ALTER TABLE categories ADD UNIQUE KEY u_slug (slug)'); } catch(_) {}

		await conn.commit();
		await Category.ensureDefaults();
		console.log('✅ Tabela categories ajustada');
		process.exit(0);
	} catch (e) {
		await conn.rollback();
		console.error('❌ Erro ao ajustar categories:', e);
		process.exit(1);
	} finally {
		conn.release();
	}
})();
