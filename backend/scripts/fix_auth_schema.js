// Script para ajustar o schema do banco para autenticação de clientes
// - Garante colunas/tabelas necessárias (usuarios, sessoes)
// - Adiciona/ajusta tipo_usuario para aceitar 'customer' e 'cliente'
// - Adiciona user_id em sessoes se faltar

const { pool } = require('../src/config/database');

async function tableExists(table) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) as c FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [table]
  );
  return rows[0].c > 0;
}

async function columnExists(table, column) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) as c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column]
  );
  return rows[0].c > 0;
}

async function indexExists(table, indexName) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) as c FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?',
    [table, indexName]
  );
  return rows[0].c > 0;
}

async function ensureUsuarios() {
  const has = await tableExists('usuarios');
  if (!has) {
    console.log('• Criando tabela usuarios (básica)');
    await pool.query(`
      CREATE TABLE usuarios (
        id INT PRIMARY KEY AUTO_INCREMENT,
        nome VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        senha VARCHAR(255) NOT NULL,
        telefone VARCHAR(30) NULL,
        endereco VARCHAR(255) NULL,
        cidade VARCHAR(100) NULL,
        estado VARCHAR(10) NULL,
        cep VARCHAR(20) NULL,
        data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
        ativo TINYINT(1) DEFAULT 1,
        UNIQUE KEY uk_usuarios_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } else {
    // Garantir colunas críticas
    const criticalCols = [
      ['nome', "ALTER TABLE usuarios ADD COLUMN nome VARCHAR(100) NOT NULL"],
      ['email', "ALTER TABLE usuarios ADD COLUMN email VARCHAR(100) NOT NULL"],
      ['senha', "ALTER TABLE usuarios ADD COLUMN senha VARCHAR(255) NOT NULL"],
      ['data_cadastro', "ALTER TABLE usuarios ADD COLUMN data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP"],
      ['ativo', "ALTER TABLE usuarios ADD COLUMN ativo TINYINT(1) DEFAULT 1"]
    ];
    for (const [col, sql] of criticalCols) {
      if (!(await columnExists('usuarios', col))) {
        console.log(`• Adicionando coluna usuarios.${col}`);
        await pool.query(sql);
      }
    }
    // Email único
    if (!(await indexExists('usuarios', 'uk_usuarios_email'))) {
      try {
        await pool.query('CREATE UNIQUE INDEX uk_usuarios_email ON usuarios(email)');
      } catch (_) {}
    }
  }
}

async function ensureSessoes() {
  const has = await tableExists('sessoes');
  if (!has) {
    console.log('• Criando tabela sessoes');
    await pool.query(`
      CREATE TABLE sessoes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        token_hash VARCHAR(255) NOT NULL,
        admin_id INT NULL,
        user_id INT NULL,
        tipo_usuario ENUM('admin','customer','cliente') NOT NULL,
        ip_address VARCHAR(45) NULL,
        user_agent TEXT NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        expira_em DATETIME NOT NULL,
        ativo TINYINT(1) DEFAULT 1,
        INDEX idx_token_hash (token_hash),
        INDEX idx_admin_id (admin_id),
        INDEX idx_user_id (user_id),
        INDEX idx_expira_em (expira_em),
        CONSTRAINT fk_sessoes_user_id FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    return;
  }

  // Adições/Ajustes
  if (!(await columnExists('sessoes', 'token_hash'))) {
    await pool.query("ALTER TABLE sessoes ADD COLUMN token_hash VARCHAR(255) NOT NULL");
  }
  if (!(await columnExists('sessoes', 'user_id'))) {
    console.log('• Adicionando coluna sessoes.user_id');
    await pool.query('ALTER TABLE sessoes ADD COLUMN user_id INT NULL');
  }
  if (!(await columnExists('sessoes', 'tipo_usuario'))) {
    await pool.query("ALTER TABLE sessoes ADD COLUMN tipo_usuario ENUM('admin','customer','cliente') NOT NULL");
  } else {
    // Garantir que o enum aceite ambos valores
    try {
      await pool.query("ALTER TABLE sessoes MODIFY COLUMN tipo_usuario ENUM('admin','customer','cliente') NOT NULL");
    } catch (_) {}
  }
  if (!(await columnExists('sessoes', 'ip_address'))) {
    await pool.query('ALTER TABLE sessoes ADD COLUMN ip_address VARCHAR(45) NULL');
  }
  if (!(await columnExists('sessoes', 'user_agent'))) {
    await pool.query('ALTER TABLE sessoes ADD COLUMN user_agent TEXT NULL');
  }
  if (!(await columnExists('sessoes', 'criado_em'))) {
    await pool.query('ALTER TABLE sessoes ADD COLUMN criado_em DATETIME DEFAULT CURRENT_TIMESTAMP');
  }
  if (!(await columnExists('sessoes', 'expira_em'))) {
    await pool.query('ALTER TABLE sessoes ADD COLUMN expira_em DATETIME NOT NULL');
  }
  if (!(await columnExists('sessoes', 'ativo'))) {
    await pool.query('ALTER TABLE sessoes ADD COLUMN ativo TINYINT(1) DEFAULT 1');
  }
  if (!(await indexExists('sessoes', 'idx_token_hash'))) {
    try { await pool.query('CREATE INDEX idx_token_hash ON sessoes(token_hash)'); } catch (_) {}
  }
  if (!(await indexExists('sessoes', 'idx_admin_id'))) {
    try { await pool.query('CREATE INDEX idx_admin_id ON sessoes(admin_id)'); } catch (_) {}
  }
  if (!(await indexExists('sessoes', 'idx_user_id'))) {
    try { await pool.query('CREATE INDEX idx_user_id ON sessoes(user_id)'); } catch (_) {}
  }
  if (!(await indexExists('sessoes', 'idx_expira_em'))) {
    try { await pool.query('CREATE INDEX idx_expira_em ON sessoes(expira_em)'); } catch (_) {}
  }
  // Tentar criar FK se possível
  try {
    await pool.query('ALTER TABLE sessoes ADD CONSTRAINT fk_sessoes_user_id FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE');
  } catch (_) {}
}

async function main() {
  try {
    console.log('🔧 Ajustando schema de autenticação...');
    await ensureUsuarios();
    await ensureSessoes();
    console.log('✅ Ajustes concluídos');
    process.exit(0);
  } catch (err) {
    console.error('❌ Falha ao ajustar schema:', err.message);
    process.exit(1);
  }
}

main();
