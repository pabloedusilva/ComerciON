// Rotas para Store (Status e Horários)
const express = require('express');
const router = express.Router();
const StoreController = require('../../controllers/admin/storeController');

// GET /api/admin/store/status - Buscar status e horários
router.get('/status', StoreController.getStatus);

// PUT /api/admin/store/status - Atualizar status (aberto/fechado)
router.put('/status', StoreController.updateStatus);

// PUT /api/admin/store/hours - Atualizar horários de funcionamento
router.put('/hours', StoreController.updateHours);

// POST /api/admin/store/hours/reset - Resetar horários para padrão
router.post('/hours/reset', StoreController.resetHours);

module.exports = router;
