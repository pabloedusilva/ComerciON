// /api/admin/dashboard
const express = require('express');
const router = express.Router();
const { autenticarAdmin } = require('../../middleware/auth');
const { sanitizarEntrada } = require('../../middleware/validation');
const ctrl = require('../../controllers/admin/dashboardController');

router.use(sanitizarEntrada);

router.get('/', autenticarAdmin, ctrl.summary);

module.exports = router;