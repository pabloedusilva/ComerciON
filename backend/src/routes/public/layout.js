const express = require('express');
const router = express.Router();
const PublicLayoutController = require('../../controllers/public/layoutController');

// GET /api/public/layout
router.get('/', PublicLayoutController.getLayout);

module.exports = router;