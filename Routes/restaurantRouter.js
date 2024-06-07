const express = require('express');
const restaurantController = require('../Controllers/restaurantController');
const restaurantAuth = require('../Controllers/restaurantAuthController')
const router = express.Router();

// Define routes
router.get('/:latitude/:longitude', restaurantAuth.protect , restaurantController.getAllApprovedRestaurants);
router.get('/topRated/:latitude/:longitude', restaurantAuth.protect , restaurantController.getAllTopRatedRestaurants);
router.post('/', restaurantAuth.protect, restaurantController.createRestaurant);
router.get('/:id',restaurantAuth.protect, restaurantController.getRestaurantById);
router.patch('/:id', restaurantController.updateRestaurant);
router.delete('/:id', restaurantController.deleteRestaurant);
router.post('/sellerSendOtp', restaurantController.sellerOTPsender);
router.post('/sellerLogin/:phNO', restaurantController.sellerLogin);

module.exports = router;
