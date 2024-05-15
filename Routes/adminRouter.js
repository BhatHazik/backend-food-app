const express = require('express');
const adminController = require('../Controllers/adminController');

const router = express.Router();


router.get('/unApprovedRestaurants', adminController.getRestaurantsAdmin);
router.patch('/approveRestaurant/:id', adminController.approveRestaurants);


module.exports = router;