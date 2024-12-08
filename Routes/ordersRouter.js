const express = require('express');
const { createOrder, getOrderDetails, getOrdersById, getAllOrdersRestaurant, getItemsOrder, getPastOrders, reorder } = require('../Controllers/ordersController');
const userAuth = require('../Controllers/authController');
const { protect } = require('../Controllers/restaurantAuthController');
const router = express.Router();

// ----------------------------------------------------------------
// User Routes
// ----------------------------------------------------------------
router.post('/placeOrder', userAuth.protect, createOrder);
router.post('/reorder', userAuth.protect, reorder);
router.get('/user/getOrderDetails', userAuth.protect, getOrderDetails);
router.get('/getOrders/:id', userAuth.protect, getOrdersById);
router.get('/getPastOrders', userAuth.protect, getPastOrders);


// ----------------------------------------------------------------
// Restaurant Routes
// ----------------------------------------------------------------

router.get('/restaurantOrders', protect, getAllOrdersRestaurant);
router.get('/getRestaurantOrderDetails/:id' , protect, getItemsOrder);


module.exports = router;