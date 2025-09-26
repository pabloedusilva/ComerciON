// /api/admin/orders
const express = require('express');
const router = express.Router();
const { autenticarAdmin } = require('../../middleware/auth');
const { sanitizarEntrada } = require('../../middleware/validation');
const ctrl = require('../../controllers/admin/ordersController');

router.use(sanitizarEntrada);

router.get('/', autenticarAdmin, ctrl.list);
router.get('/:id', autenticarAdmin, ctrl.getById);
router.put('/:id/status', autenticarAdmin, ctrl.updateStatus);

module.exports = router;