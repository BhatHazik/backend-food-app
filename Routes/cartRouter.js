const express = require("express");
const cartController = require("../Controllers/cartController");
const auth = require("../Controllers/authController");
const router = express.Router();

router.post("/addItem/:id", auth.protect, cartController.addItemCart);
router.post(
  "/RemoveAndAddItem/:id",
  auth.protect,
  cartController.removeItemsFromCartAndAddNew
);
router.get("/getItems", auth.protect, cartController.getItemsCart);
router.patch("/itemQuantity/:id", auth.protect, cartController.itemQuantity);
module.exports = router;
