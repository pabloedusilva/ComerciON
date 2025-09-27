// Rotas públicas para Store
const express = require('express');
const router = express.Router();
const PublicStoreController = require('../../controllers/public/storeController');

// GET /api/public/store - Status público da loja
router.get('/', PublicStoreController.getStoreStatus);

module.exports = router;