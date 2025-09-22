// Script para ajustar a coluna img da tabela products para MEDIUMTEXT
require('dotenv').config();
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const { dbHost, dbPort, dbUser, dbPass, dbName } = require('../src/config/environment');

(async () => {
  const conn = await mysql.createConnection({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPass,
    database: dbName,
    ssl: { rejectUnauthorized: false }
  });
  try {
    const [cols] = await conn.execute("SHOW COLUMNS FROM products LIKE 'img'");
    if (!cols.length) {
      console.log('Coluna img não encontrada, criando como MEDIUMTEXT...');
      await conn.execute('ALTER TABLE products ADD COLUMN img MEDIUMTEXT NULL');
    } else {
      const type = String(cols[0].Type).toLowerCase();
      if (!(type.includes('mediumtext') || type.includes('longtext'))) {
        console.log(`Alterando coluna img (${type}) para MEDIUMTEXT...`);
        await conn.execute('ALTER TABLE products MODIFY COLUMN img MEDIUMTEXT NULL');
      } else {
        console.log('Coluna img já está em tipo MEDIUMTEXT/LONGTEXT.');
      }
    }
    console.log('✅ Ajuste concluído.');
  } catch (e) {
    console.error('❌ Erro ao ajustar coluna img:', e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
})();
