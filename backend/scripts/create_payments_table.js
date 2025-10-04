const { pool } = require('../src/config/database');

async function createPaymentsTable() {
    try {
        console.log('Criando tabela payments...');
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                provider VARCHAR(50) NOT NULL DEFAULT 'infinitepay',
                txid VARCHAR(255) NOT NULL UNIQUE,
                status VARCHAR(50) NOT NULL,
                amount DECIMAL(10,2) DEFAULT 0,
                received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_order_id (order_id),
                INDEX idx_txid (txid),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        console.log('✅ Tabela payments criada com sucesso!');
        
        // Verificar se a tabela foi criada
        const [tables] = await pool.query("SHOW TABLES LIKE 'payments'");
        if (tables.length > 0) {
            console.log('✅ Tabela payments confirmada no banco de dados');
        }
        
    } catch (error) {
        console.error('❌ Erro ao criar tabela payments:', error);
    } finally {
        process.exit(0);
    }
}

createPaymentsTable();