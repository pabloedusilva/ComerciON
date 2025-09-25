// Rotas de pedidos do cliente - protegidas
const express = require('express');
const router = express.Router();
const { autenticarCliente } = require('../../middleware/auth');
const { sanitizarEntrada } = require('../../middleware/validation');
const rateLimit = require('express-rate-limit');

const limitePedidos = rateLimit({ windowMs: 60 * 1000, max: process.env.NODE_ENV==='production'? 60: 600 });

router.use(sanitizarEntrada);
router.use(autenticarCliente);
router.use(limitePedidos);

// Exemplo de rota protegida (listar pedidos do usuário)
router.get('/', async (req, res) => {
	try {
		// TODO: implementar busca real dos pedidos do req.usuario.id
		return res.json({ sucesso: true, pedidos: [] });
	} catch (e) {
		return res.status(500).json({ sucesso: false, mensagem: 'Erro ao obter pedidos' });
	}
});

module.exports = router;