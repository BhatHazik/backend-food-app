const express = require('express');
const UserBillController = require('../Controllers/userBillController');
const userAuth = require('../Controllers/authController');
const router = express.Router();

router.post('/userBill', userAuth.protect,UserBillController.calculateBill);


module.exports = router;