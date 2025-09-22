// /api/admin/products
const express = require('express');
const router = express.Router();
const { autenticarAdmin } = require('../../middleware/auth');
const { validarProdutoCreate, validarProdutoUpdate, sanitizarEntrada } = require('../../middleware/validation');
const ctrl = require('../../controllers/admin/productsController');

// Listar todos (admin vê ativos e inativos)
router.use(sanitizarEntrada);
router.get('/', autenticarAdmin, ctrl.list);

// Criar
router.post('/', autenticarAdmin, validarProdutoCreate, ctrl.create);

// Atualizar
router.put('/:id', autenticarAdmin, validarProdutoUpdate, ctrl.update);

// Remover
router.delete('/:id', autenticarAdmin, ctrl.remove);

module.exports = router;