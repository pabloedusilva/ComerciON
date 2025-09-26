// Rotas de reviews do cliente
const express = require('express');
const router = express.Router();
const { sanitizarEntrada } = require('../../middleware/validation');
const { autenticarCliente } = require('../../middleware/auth');
const reviewsController = require('../../controllers/customer/reviewsController');

router.use(autenticarCliente, sanitizarEntrada);

// Criar avaliação
router.post('/', reviewsController.create);
// Listar avaliações do usuário
router.get('/', reviewsController.list);

module.exports = router;
