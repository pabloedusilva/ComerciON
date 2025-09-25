// Run a .sql file against the configured database using the pool
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/database');

async function run() {
  try {
    const file = process.argv[2];
    if (!file) {
      console.error('Uso: node scripts/run_sql.js <path_para_sql>');
      process.exit(1);
    }
    const full = path.resolve(__dirname, '..', file.endsWith('.sql') ? file : `${file}`);
    if (!fs.existsSync(full)) {
      console.error('Arquivo SQL não encontrado:', full);
      process.exit(1);
    }
    const sql = fs.readFileSync(full, 'utf8');
    // Split on semicolons; naive but adequate for our simple migration (no procedures)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      try {
        // Some MySQL servers may not support IF NOT EXISTS on ADD COLUMN; wrap in try
        await pool.query(stmt);
      } catch (err) {
        // Best effort: log and continue
        console.warn('Aviso ao executar SQL:', err.message);
      }
    }
    console.log('✅ SQL executado com sucesso');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro ao executar SQL:', err.message);
    process.exit(1);
  }
}

run();
