const express = require('express');
const restaurantController = require('../Controllers/restaurantController');

const router = express.Router();

// Define routes
router.post('/', restaurantController.createRestaurant);
router.get('/', restaurantController.getAllApprovedRestaurants);
router.get('/:id', restaurantController.getRestaurantById);
router.patch('/:id', restaurantController.updateRestaurant);
router.delete('/:id', restaurantController.deleteRestaurant);

module.exports = router;
