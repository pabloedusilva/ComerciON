// Rotas admin principais
const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const productsRoutes = require('./products');
const layoutRoutes = require('./layout');
const settingsRoutes = require('./settings');
const deliveryRoutes = require('./delivery');
const developerRoutes = require('./developer');
const reportsRoutes = require('./reports');
const reviewsRoutes = require('./reviews');
const customersRoutes = require('./customers');
const ordersRoutes = require('./orders');
const dashboardRoutes = require('./dashboard');
const storeRoutes = require('./store');

router.use('/auth', authRoutes);
router.use('/products', productsRoutes);
router.use('/layout', layoutRoutes);
router.use('/settings', settingsRoutes);
router.use('/delivery', deliveryRoutes);
router.use('/developer', developerRoutes);
router.use('/reports', reportsRoutes);
router.use('/reviews', reviewsRoutes);
router.use('/customers', customersRoutes);
router.use('/orders', ordersRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/store', storeRoutes);

module.exports = router;