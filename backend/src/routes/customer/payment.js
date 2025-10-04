const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { autenticarCliente } = require('../../middleware/auth');
const { sanitizarEntrada } = require('../../middleware/validation');
const ctrl = require('../../controllers/customer/paymentController');

const limiter = rateLimit({ windowMs: 60 * 1000, max: process.env.NODE_ENV==='production'? 60: 300 });

router.use(sanitizarEntrada);
router.use(limiter);

router.post('/infinitepay/checkout-link', autenticarCliente, ctrl.createInfinitePayLink);
router.get('/infinitepay/success', ctrl.successReturn);
// Webhook público do provedor (usar segredo HMAC para validar)
// Captura o raw body para validar assinaturas baseadas no corpo bruto (muitos provedores usam esse formato)
router.post(
	'/infinitepay/webhook',
	express.json({
		limit: '1mb',
		verify: (req, _res, buf) => { try { req.rawBody = buf.toString('utf8'); } catch(_) { req.rawBody = undefined; } }
	}),
	(req, res, next) => {
	try { console.log('InfinitePay webhook', new Date().toISOString(), 'ip:', req.ip); } catch(_) {}
		next();
	},
	ctrl.webhookInfinitePay
);

module.exports = router;
