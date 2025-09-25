// Rotas de reviews do cliente (placeholder)
const express = require('express');
const router = express.Router();
const { sanitizarEntrada } = require('../../middleware/validation');

router.use(sanitizarEntrada);

// GET /api/customer/reviews/health
router.get('/health', (req, res) => {
	res.json({ sucesso: true, mensagem: 'reviews ok' });
});

module.exports = router;