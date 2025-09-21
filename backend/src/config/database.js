// Configuração MySQL Railway
const mysql = require('mysql2/promise');
const { dbHost, dbPort, dbName, dbUser, dbPass } = require('./environment');

// Configuração da conexão com o banco Railway
const dbConfig = {
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPass,
    database: dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: false
    },
    timezone: '+00:00' // UTC para evitar warning
};

// Pool de conexões para performance
const pool = mysql.createPool(dbConfig);

// Teste de conexão
const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Conectado ao banco Railway MySQL');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Erro ao conectar no banco:', error.message);
        return false;
    }
};

module.exports = {
    pool,
    testConnection
};