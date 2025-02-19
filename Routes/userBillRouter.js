const express = require("express");
const UserBillController = require("../Controllers/userBillController");
const userAuth = require("../Controllers/authController");
const router = express.Router();

router.get("/userBill", userAuth.protect, UserBillController.getMyBill);

module.exports = router;
