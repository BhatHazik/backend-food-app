const express = require('express');
const { getAllApprovedRestaurants, getAllTopRatedRestaurants, getAllPopularRestaurants, getAllRestaurantsBySearch, getSellerDashboard, createRestaurant, createRestaurantDocs, getRestaurantById, updateRestaurant, deleteRestaurant, sellerLogin, sellerOTPsender } = require('../Controllers/restaurantController');
const restaurantAuth = require('../Controllers/restaurantAuthController');
const userAuth = require('../Controllers/authController');
const router = express.Router();

router.get('/nearest/:latitude/:longitude', userAuth.protect , getAllApprovedRestaurants);
router.get('/topRated/:latitude/:longitude', userAuth.protect , getAllTopRatedRestaurants);
router.get('/popular/:latitude/:longitude', userAuth.protect , getAllPopularRestaurants);
router.get('/category', userAuth.protect , getAllRestaurantsBySearch);

router.get('/sellerDashboard', restaurantAuth.protect, getSellerDashboard);
router.post('/submitRestaurantInfo', restaurantAuth.protect, createRestaurant);
router.post('/submitRestaurantDocs', restaurantAuth.protect, createRestaurantDocs);
router.get('/:id',userAuth.protect, getRestaurantById);
router.patch('/:id', updateRestaurant);
router.delete('/:id', deleteRestaurant);
router.post('/sellerSendOtp', sellerOTPsender);
router.post('/sellerLogin/:phNO', sellerLogin);

module.exports = router;
