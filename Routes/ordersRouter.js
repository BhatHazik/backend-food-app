const express = require('express');
const { createOrder, getOrderDetails, getOrdersById, getAllOrdersRestaurant, getItemsOrder } = require('../Controllers/ordersController');
const userAuth = require('../Controllers/authController');
const { protect } = require('../Controllers/restaurantAuthController');
const router = express.Router();

// ----------------------------------------------------------------
// User Routes
// ----------------------------------------------------------------
router.post('/placeOrder', userAuth.protect, createOrder);
router.get('/user/getOrderDetails', userAuth.protect, getOrderDetails);
router.get('/getOrders/:id', userAuth.protect, getOrdersById);



// ----------------------------------------------------------------
// Restaurant Routes
// ----------------------------------------------------------------

router.get('/restaurantOrders', protect, getAllOrdersRestaurant);
router.get('/getRestaurantOrderDetails/:id' , protect, getItemsOrder);


module.exports = router;