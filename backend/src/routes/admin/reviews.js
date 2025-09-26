// /api/admin/reviews
const express = require('express');
const router = express.Router();
const { autenticarAdmin } = require('../../middleware/auth');
const { sanitizarEntrada } = require('../../middleware/validation');
const reviewsController = require('../../controllers/admin/reviewsController');

router.use(autenticarAdmin, sanitizarEntrada);

// Listar avaliações com filtros ?q=&rating=&limit=&offset=
router.get('/', reviewsController.list);

// Remover (moderação) - opcional
router.delete('/:id', reviewsController.remove);

module.exports = router;
