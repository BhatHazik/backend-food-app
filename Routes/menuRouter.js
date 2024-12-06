const express = require('express');
const { getMenuById, searchItemsInRestaurant } = require('../Controllers/menuController');
const userAuth = require('../Controllers/authController')
const router = express.Router();

// router.post('/:id', createMenu);
router.get('/getItemsBySearch/:id', searchItemsInRestaurant);
router.get('/:id/:latitude/:longitude',userAuth.protect, getMenuById);
// router.patch('/:id', updateMenuItem);
// router.delete('/:id', deleteMenuItem);

module.exports = router;
