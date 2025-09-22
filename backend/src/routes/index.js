// Router principal
const express = require('express');
const router = express.Router();

// Rotas de autenticação
const customerAuthRoutes = require('./customer/auth');
const adminAuthRoutes = require('./admin/auth');
// Rotas de catálogo público e admin produtos
const publicCatalogRoutes = require('./public/catalog');
const publicLayoutRoutes = require('./public/layout');
const adminProductsRoutes = require('./admin/products');
const adminLayoutRoutes = require('./admin/layout');

// Middleware de log para rotas da API
router.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
    next();
});

// Rota de health check
router.get('/health', (req, res) => {
    res.json({
        sucesso: true,
        mensagem: 'API funcionando',
        timestamp: new Date().toISOString()
    });
});

// Endpoint para resetar rate limit em desenvolvimento
if (process.env.NODE_ENV === 'development') {
    router.post('/dev/reset-rate-limit', (req, res) => {
        res.status(200).json({
            sucesso: true,
            mensagem: 'Rate limit resetado! Aguarde alguns segundos.',
            timestamp: new Date().toISOString()
        });
    });
}

// Rotas de autenticação
router.use('/customer/auth', customerAuthRoutes);
router.use('/admin/auth', adminAuthRoutes);
router.use('/public/catalog', publicCatalogRoutes);
router.use('/public/layout', publicLayoutRoutes);
router.use('/admin/products', adminProductsRoutes);
router.use('/admin/layout', adminLayoutRoutes);

// Rota 404 para API
router.use('*', (req, res) => {
    res.status(404).json({
        sucesso: false,
        mensagem: 'Endpoint não encontrado'
    });
});

module.exports = router;