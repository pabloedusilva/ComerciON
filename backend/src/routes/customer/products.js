// Rotas de produtos para cliente (placeholder)
const express = require('express');
const router = express.Router();
const { sanitizarEntrada } = require('../../middleware/validation');

router.use(sanitizarEntrada);

// GET /api/customer/products/health
router.get('/health', (req, res) => {
	res.json({ sucesso: true, mensagem: 'products ok' });
});

module.exports = router;