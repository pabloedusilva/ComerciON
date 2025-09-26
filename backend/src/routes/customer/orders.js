// /api/customer/orders
const express = require('express');
const router = express.Router();
const { autenticarCliente } = require('../../middleware/auth');
const { sanitizarEntrada } = require('../../middleware/validation');
const rateLimit = require('express-rate-limit');
const ctrl = require('../../controllers/customer/ordersController');

const limitePedidos = rateLimit({ windowMs: 60 * 1000, max: process.env.NODE_ENV==='production'? 60: 600 });

router.use(sanitizarEntrada);
router.use(limitePedidos);

router.get('/', autenticarCliente, ctrl.list);
router.get('/:id', autenticarCliente, ctrl.getById);
router.post('/', autenticarCliente, ctrl.create);

module.exports = router;