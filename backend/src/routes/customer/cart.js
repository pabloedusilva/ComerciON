// Rotas de carrinho do cliente (placeholder)
const express = require('express');
const router = express.Router();
const { sanitizarEntrada } = require('../../middleware/validation');

router.use(sanitizarEntrada);

// GET /api/customer/cart/health
router.get('/health', (req, res) => {
	res.json({ sucesso: true, mensagem: 'cart ok' });
});

module.exports = router;