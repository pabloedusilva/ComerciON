// Rotas customer principais
const express = require('express');
const router = express.Router();

const profileRoutes = require('./profile');
const ordersRoutes = require('./orders');
const cartRoutes = require('./cart');
const productsRoutes = require('./products');
const reviewsRoutes = require('./reviews');
const paymentRoutes = require('./payment');
const checkoutIntentsRoutes = require('./checkoutIntents');

router.use('/profile', profileRoutes);
router.use('/orders', ordersRoutes);
router.use('/payment', paymentRoutes);
router.use('/checkout-intents', checkoutIntentsRoutes);
router.use('/cart', cartRoutes);
router.use('/products', productsRoutes);
router.use('/reviews', reviewsRoutes);

module.exports = router;