const express = require("express");
const {
  getMenuById,
  searchItemsInRestaurant,
} = require("../Controllers/menuController");
const userAuth = require("../Controllers/authController");
const router = express.Router();

router.get("/getItemsBySearch/:id", searchItemsInRestaurant);
router.get("/:id/:latitude/:longitude", userAuth.protect, getMenuById);

module.exports = router;
