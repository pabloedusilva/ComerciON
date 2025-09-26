// /api/admin/reviews
const express = require('express');
const router = express.Router();
const { autenticarAdmin } = require('../../middleware/auth');
const { sanitizarEntrada } = require('../../middleware/validation');

router.use(autenticarAdmin, sanitizarEntrada);

router.get('/', (req, res) => {
	res.json({ ok: true, message: 'Reviews endpoint disponível' });
});

module.exports = router;