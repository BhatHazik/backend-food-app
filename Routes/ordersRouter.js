const express = require('express');
const OrdersController = require('../Controllers/ordersController');
const userAuth = require('../Controllers/authController');
const router = express.Router();

router.post('/placeOrder/:distance/:delivery_tip/:code', userAuth.protect,OrdersController.createOrder);
router.get('/user/getOrderDetails', userAuth.protect,OrdersController.getOrderDetails);

module.exports = router;