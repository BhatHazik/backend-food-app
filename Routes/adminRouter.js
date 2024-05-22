const express = require('express');
const adminController = require('../Controllers/adminController');

const router = express.Router();


router.get('/unApprovedRestaurants', adminController.getRestaurantsAdmin);
router.patch('/approveRestaurant/:id', adminController.approveRestaurants);
router.get('/unApprovedDeleveryBoys', adminController.getDeleveryBoysAdmin);
router.patch('/approveDeleveryBoy/:id', adminController.approveDeleveryBoys);
module.exports = router;