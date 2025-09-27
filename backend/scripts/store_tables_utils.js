// Store Tables Management Utils
const { pool } = require('../src/config/database');

async function createStoreStatusTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS StoreStatus (
      id INT PRIMARY KEY DEFAULT 1,
      closed_now BOOLEAN DEFAULT FALSE,
      reason TEXT,
      reopen_at DATETIME NULL,
      notify_whatsapp BOOLEAN DEFAULT FALSE,
      notify_email BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;
  
  await pool.execute(query);
  
  // Inserir registro padrão se não existir
  await pool.execute(`
    INSERT IGNORE INTO StoreStatus (id, closed_now) VALUES (1, FALSE)
  `);
}

async function createStoreHoursTable() {
  // Primeiro, verificar se a tabela já existe e droppar se necessário
  await pool.execute('DROP TABLE IF EXISTS StoreHours');
  
  const query = `
    CREATE TABLE StoreHours (
      id INT AUTO_INCREMENT PRIMARY KEY,
      day_of_week INT NOT NULL, -- 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
      enabled BOOLEAN DEFAULT TRUE,
      open_time TIME DEFAULT '18:00:00',
      close_time TIME DEFAULT '23:00:00',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_day (day_of_week)
    )
  `;
  
  await pool.execute(query);
  
  // Inserir horários padrão
  const defaultHours = [
    { day: 0, enabled: true, open: '18:00:00', close: '23:00:00' }, // Domingo
    { day: 1, enabled: true, open: '18:00:00', close: '23:00:00' }, // Segunda
    { day: 2, enabled: true, open: '18:00:00', close: '23:00:00' }, // Terça
    { day: 3, enabled: true, open: '18:00:00', close: '23:00:00' }, // Quarta
    { day: 4, enabled: true, open: '18:00:00', close: '23:00:00' }, // Quinta
    { day: 5, enabled: true, open: '18:00:00', close: '23:00:00' }, // Sexta
    { day: 6, enabled: true, open: '18:00:00', close: '23:00:00' }  // Sábado
  ];
  
  for (const hour of defaultHours) {
    await pool.execute(`
      INSERT INTO StoreHours (day_of_week, enabled, open_time, close_time) 
      VALUES (?, ?, ?, ?)
    `, [hour.day, hour.enabled, hour.open, hour.close]);
  }
}

async function dropStoreTables() {
  await pool.execute('DROP TABLE IF EXISTS StoreStatus');
  await pool.execute('DROP TABLE IF EXISTS StoreHours');
}

module.exports = {
  createStoreStatusTable,
  createStoreHoursTable,
  dropStoreTables
};
