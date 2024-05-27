const express = require('express');
const cartController = require('../Controllers/cartController');
const auth = require('../Controllers/authController');
const router = express.Router();


router.patch('/addItem/:id', auth.protect, cartController.addItemCart);

module.exports = router;
