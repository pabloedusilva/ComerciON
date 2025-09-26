// /api/admin/customers
const express = require('express');
const router = express.Router();
const { autenticarAdmin } = require('../../middleware/auth');
const { sanitizarEntrada } = require('../../middleware/validation');
const ctrl = require('../../controllers/admin/customersController');

router.use(sanitizarEntrada);

// Listar clientes
router.get('/', autenticarAdmin, ctrl.list);

// Obter um cliente
router.get('/:id', autenticarAdmin, ctrl.getById);

module.exports = router;