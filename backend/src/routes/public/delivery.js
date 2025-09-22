// /api/public/delivery
const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/public/deliveryController');

router.get('/areas', ctrl.listActiveAreas);
router.get('/fee', ctrl.getFeeByCityState); // ?city=Nome&uf=SP

module.exports = router;
