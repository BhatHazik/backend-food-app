const express = require("express");
const offersController = require("../Controllers/offersController");
const restaurantAuth = require("../Controllers/restaurantAuthController");
const { protect } = require("../Controllers/authController");
const router = express.Router();

router.post("/", offersController.createOffer);
router.post(
  "/seller/accept/:offer_id",
  restaurantAuth.protect,
  offersController.acceptOfferSeller
);
router.get("/", offersController.getOffers);
router.get(
  "/getOffersFromRestaurant/:restaurant_id",
  protect,
  offersController.getOffersFromRestaurants
);
router.get("/:offer_id", offersController.getOfferById);
router.patch("/:offer_id", offersController.updateOfferById);
router.delete("/:offer_id", offersController.deleteOfferById);

module.exports = router;
