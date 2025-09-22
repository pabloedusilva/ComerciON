const express = require('express');
const router = express.Router();
const { autenticarAdmin } = require('../../middleware/auth');
const { sanitizarEntrada } = require('../../middleware/validation');
const LayoutController = require('../../controllers/admin/layoutController');

router.use(autenticarAdmin, sanitizarEntrada);

// GET /api/admin/layout - obter configurações
router.get('/', LayoutController.getSettings);

// PUT /api/admin/layout/logo - atualizar logo (image: dataURL ou URL)
router.put('/logo', LayoutController.updateLogo);

// PUT /api/admin/layout/background - atualizar background da home
router.put('/background', LayoutController.updateBackground);

// PUT /api/admin/layout/texts - atualizar textos da home
router.put('/texts', LayoutController.updateHomeTexts);

// PUT /api/admin/layout/carousel - atualizar carousel inteiro
router.put('/carousel', LayoutController.updateCarousel);

// PUT /api/admin/layout/instagram - atualizar seção Instagram
router.put('/instagram', LayoutController.updateInstagram);

module.exports = router;// /api/admin/layout