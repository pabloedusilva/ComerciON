const express = require('express');
const router = express.Router();
const PublicSettingsController = require('../../controllers/public/settingsController');

// GET /api/public/settings
router.get('/', PublicSettingsController.getSettings);

module.exports = router;
