// Entry point - Servidor principal
const app = require('./src/app');
const environment = require('./src/config/environment');
const http = require('http');
const { setupSockets } = require('./src/sockets');

const PORT = environment.port;

// Criar servidor HTTP e anexar Socket.IO
const server = http.createServer(app);

// Inicializar sockets
const io = setupSockets(server);

server.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`� URL: http://localhost:${PORT}`);
    console.log(`🌐 Ambiente: ${environment.nodeEnv}`);
});

// Tornar io acessível em toda a app quando necessário
app.set('io', io);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📴 Recebido SIGTERM. Encerrando servidor...');
    server.close(() => {
        console.log('✅ Servidor encerrado com sucesso');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('📴 Recebido SIGINT (Ctrl+C). Encerrando servidor...');
    server.close(() => {
        console.log('✅ Servidor encerrado com sucesso');
        process.exit(0);
    });
});

// Tratar erros não capturados
process.on('uncaughtException', (error) => {
    console.error('❌ Erro não capturado:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promise rejeitada não tratada:', reason);
    process.exit(1);
});

module.exports = server;