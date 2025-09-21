// Utilitário para resetar rate limiting em desenvolvimento
const resetRateLimit = (req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
        // Limpar headers de rate limit para testes
        req.ip = req.ip + '_' + Date.now(); // IP único para cada requisição em dev
    }
    next();
};

module.exports = { resetRateLimit };