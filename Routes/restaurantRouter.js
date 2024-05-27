const express = require('express');
const restaurantController = require('../Controllers/restaurantController');
const authorization = require('../Controllers/authController')
const router = express.Router();

// Define routes
router.get('/', authorization.protect , restaurantController.getAllApprovedRestaurants);
router.post('/', restaurantController.createRestaurant);
router.get('/getId/:id', restaurantController.getRestaurantById);
router.patch('/:id', restaurantController.updateRestaurant);
router.delete('/:id', restaurantController.deleteRestaurant);

module.exports = router;
