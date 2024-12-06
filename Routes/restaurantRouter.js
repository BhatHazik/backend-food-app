const express = require('express');
const restaurantController = require('../Controllers/restaurantController');
const restaurantAuth = require('../Controllers/restaurantAuthController');
const userAuth = require('../Controllers/authController');
const router = express.Router();

router.get('/nearest/:latitude/:longitude', userAuth.protect , restaurantController.getAllApprovedRestaurants);
router.get('/topRated/:latitude/:longitude', userAuth.protect , restaurantController.getAllTopRatedRestaurants);
router.get('/popular/:latitude/:longitude', userAuth.protect , restaurantController.getAllPopularRestaurants);
router.get('/category', userAuth.protect , restaurantController.getAllRestaurantsBySearch);
router.post('/submitRestaurantInfo', restaurantAuth.protect, restaurantController.createRestaurant);
router.post('/submitRestaurantDocs', restaurantAuth.protect, restaurantController.createRestaurantDocs);
router.get('/:id',userAuth.protect, restaurantController.getRestaurantById);
router.patch('/:id', restaurantController.updateRestaurant);
router.delete('/:id', restaurantController.deleteRestaurant);
router.post('/sellerSendOtp', restaurantController.sellerOTPsender);
router.post('/sellerLogin/:phNO', restaurantController.sellerLogin);

module.exports = router;
