const express = require('express');
const { getRestaurantsAdmin, approveRestaurants, getDeleveryBoysAdmin, approveDeleveryBoys, createMainCategory, updateMainCategory, deleteMainCategory } = require('../Controllers/adminController');

const router = express.Router();


router.get('/unApprovedRestaurants', getRestaurantsAdmin);
router.patch('/approveRestaurant/:id', approveRestaurants);
router.get('/unApprovedDeleveryBoys', getDeleveryBoysAdmin);
router.patch('/approveDeleveryBoy/:id', approveDeleveryBoys);
router.patch('/approveDeleveryBoy/:id', approveDeleveryBoys);
router.post('/createCategory', createMainCategory);
router.patch('/updateCategory/:id', updateMainCategory);
router.delete('/deleteCategory', deleteMainCategory);

module.exports = router;