// /api/admin/products
const express = require('express');
const router = express.Router();
const { autenticarAdmin } = require('../../middleware/auth');
const ctrl = require('../../controllers/admin/productsController');

// Listar todos (admin vê ativos e inativos)
router.get('/', autenticarAdmin, ctrl.list);

// Criar
router.post('/', autenticarAdmin, ctrl.create);

// Atualizar
router.put('/:id', autenticarAdmin, ctrl.update);

// Remover
router.delete('/:id', autenticarAdmin, ctrl.remove);

module.exports = router;