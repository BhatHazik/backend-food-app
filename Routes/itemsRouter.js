const express = require("express");
const {
  createTitle,
  getTitlesByItemId,
  createOption,
  getOptionsByTitleId,
  checkTitlesWithNoOptions,
  updateOption,
  updateSelectionType,
  discardCustomizations,
  submitCustomizationsWithCheck,
  getCustomizations,
  submitCustomizations,
  getSelectedCustomizations,
  updateItemCustomizations,
  createItem,
  readItems,
  getTitlesWithOptionsByItemId,
} = require("../Controllers/itemController");
const auth = require("../Controllers/authController");
const { protect } = require("../Controllers/restaurantAuthController");
const upload = require("multer")();
const router = express.Router();

router.post(
  "/:id",
  protect,
  upload.fields([{ name: "thumbnail", maxCount: 1 }]),
  createItem
);
router.get("/:id", protect, readItems);
router.post("/customisation/addTitle/:id", protect, createTitle);
router.get("/customisation/getTitles/:id", protect, getTitlesByItemId);
router.get(
  "/customisation/getItemCustomisations/:id",
  protect,
  getTitlesWithOptionsByItemId
);
router.post("/customisation/addOption/:id", createOption);
router.get("/customisation/getOptions/:id", getOptionsByTitleId);
router.get("/customisation/checkTitleOptions/:id", checkTitlesWithNoOptions);
router.patch("/customisation/editOptions/:id", updateOption);
router.patch("/customisation/addSelectionType/:id", updateSelectionType);
router.delete("/customisation/discard/:id", discardCustomizations);
router.get(
  "/customisation/getCustomisation/:id",
  auth.protect,
  getCustomizations
);
router.post(
  "/customisation/setUserCustomisation/:id",
  auth.protect,
  submitCustomizations
);
router.post(
  "/customisation/setDifferCustomizations/:id",
  auth.protect,
  submitCustomizationsWithCheck
);
router.get(
  "/customisation/getSelectedCustomisation/:id",
  auth.protect,
  getSelectedCustomizations
);
router.patch(
  "/customisation/updateSelectedCustomisation/:id",
  auth.protect,
  updateItemCustomizations
);

module.exports = router;
