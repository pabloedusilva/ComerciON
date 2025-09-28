// Cria tabela de categorias se não existir e popula com defaults
const { pool } = require('../src/config/database');
const Category = require('../src/models/Category');

(async function main(){
	try {
		await Category.createTable();
		await Category.ensureDefaults();
		console.log('✅ Tabela categories verificada/criada e seeds aplicados');
		process.exit(0);
	} catch (e) {
		console.error('❌ Erro ao criar tabela categories:', e);
		process.exit(1);
	}
})();
