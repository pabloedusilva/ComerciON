// /api/admin/delivery
const express = require('express');
const router = express.Router();
const { autenticarAdmin } = require('../../middleware/auth');
const ctrl = require('../../controllers/admin/deliveryController');

// Proteger todas as rotas
router.use(autenticarAdmin);

// GET lista de áreas
router.get('/areas', ctrl.listAreas);
// POST cria/atualiza área
router.post('/areas', ctrl.upsertArea);
// DELETE remove área
router.delete('/areas/:id', ctrl.deleteArea);
// GET estatísticas reais de entregas
router.get('/stats', ctrl.getStats);

module.exports = router;