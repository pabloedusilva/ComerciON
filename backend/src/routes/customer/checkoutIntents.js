const express = require('express');
const router = express.Router();
const { autenticarCliente } = require('../../middleware/auth');
const rateLimit = require('express-rate-limit');
const { sanitizarEntrada } = require('../../middleware/validation');
const ctrl = require('../../controllers/customer/checkoutIntentsController');

const limiter = rateLimit({ windowMs: 60 * 1000, max: process.env.NODE_ENV==='production'? 40: 200 });

router.use(sanitizarEntrada);
router.use(limiter);

router.post('/', autenticarCliente, ctrl.createIntent);
router.get('/:id', autenticarCliente, ctrl.getIntent);
router.post('/:id/generate-link', autenticarCliente, ctrl.generateLink);
router.get('/:id/status', autenticarCliente, ctrl.pollStatus);

module.exports = router;