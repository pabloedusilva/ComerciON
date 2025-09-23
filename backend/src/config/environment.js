// Variáveis de ambiente
const path = require('path');
const dotenv = require('dotenv');
// Carrega o .env a partir da raiz do backend, independente do diretório atual de execução
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

module.exports = {
    // Server
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    
    // Database Railway
    dbHost: process.env.DB_HOST || 'turntable.proxy.rlwy.net',
    dbPort: process.env.DB_PORT || 58558,
    dbName: process.env.DB_NAME || 'railway',
    dbUser: process.env.DB_USER || 'root',
    dbPass: process.env.DB_PASS || '',
    
    // JWT Security
    jwtSecret: process.env.JWT_SECRET || 'super_secret_key_pizzaria_2025',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    
    // Security
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    
    // Rate Limiting
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 min
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100,
};