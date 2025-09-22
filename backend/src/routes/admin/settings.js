const express = require('express');
const router = express.Router();
const { autenticarAdmin } = require('../../middleware/auth');
const { sanitizarEntrada } = require('../../middleware/validation');
const AdminSettingsController = require('../../controllers/admin/settingsController');

router.use(autenticarAdmin, sanitizarEntrada);

// GET /api/admin/settings - obter
router.get('/', AdminSettingsController.get);

// PUT /api/admin/settings - atualizar dados básicos (nome, telefone, email, endereço)
router.put('/', AdminSettingsController.update);

// PUT /api/admin/settings/notifications - salvar preferências de notificação
router.put('/notifications', AdminSettingsController.updateNotifications);

module.exports = router;