// Script único (opcional) para criar a tabela Settings e inserir a linha padrão
// Uso manual: node backend/scripts/create_settings_table.js
// Pode ser removido após execução com sucesso.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../src/config/database');

async function run() {
  try {
    console.log('Criando tabela Settings se não existir...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS \`Settings\` (
        id INT PRIMARY KEY,
        name VARCHAR(255) NULL,
        phone VARCHAR(50) NULL,
        email VARCHAR(255) NULL,
        address TEXT NULL,
        notification_sound VARCHAR(255) NULL,
        notification_enabled TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('Garantindo registro singleton id=1...');
    await pool.execute(
      `INSERT INTO \`Settings\` (id, name, phone, email, address, notification_sound, notification_enabled)
       VALUES (1, 'Pizzaria', '(11) 99999-9999', 'contato@pizzaria.com', 'São Paulo, SP', '/assets/sounds/notificações1.mp3', 1)
       ON DUPLICATE KEY UPDATE id = id`
    );

    console.log('OK. Tabela pronta.');
    process.exit(0);
  } catch (e) {
    console.error('Erro:', e.message);
    process.exit(1);
  }
}

run();
