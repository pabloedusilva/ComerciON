// Verificar se as tabelas existem e criar admin inicial se necessário
require('dotenv').config();
const mysql = require('mysql2/promise');

const config = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: false
    }
};

async function verificarTabelas() {
    let connection;
    try {
        connection = await mysql.createConnection(config);
        console.log('✅ Conectado ao banco');

        // Verificar tabelas existentes
        const [tables] = await connection.execute("SHOW TABLES");
        console.log('📊 Tabelas encontradas:', tables.map(t => Object.values(t)[0]));

        // Verificar se existe tabela admins
        const tabelaAdmins = tables.find(t => Object.values(t)[0] === 'admins');
        if (tabelaAdmins) {
            // Verificar admins existentes
            const [admins] = await connection.execute("SELECT id, nome, email, nivel_acesso FROM admins");
            console.log('👥 Admins encontrados:', admins);
        } else {
            console.log('❌ Tabela admins não encontrada');
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

verificarTabelas();