// /api/admin/reports
const express = require('express');
const router = express.Router();
const { autenticarAdmin } = require('../../middleware/auth');
const { sanitizarEntrada } = require('../../middleware/validation');
const ReportsController = require('../../controllers/admin/reportsController');

// Proteger e sanitizar
router.use(autenticarAdmin, sanitizarEntrada);

// Rota básica para evitar 404 até implementação completa
router.get('/', ReportsController.summary);

module.exports = router;