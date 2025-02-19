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
  getItemsByCategoryId,
  getItemById,
  updateItem,
  deleteItemWithCustomisation, 
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
router.patch("/:id", protect, upload.fields([{ name: "thumbnail", maxCount: 1}]), updateItem);
router.get("/getItemById/:id", protect, getItemById);
router.get("/:id", protect, getItemsByCategoryId);
router.post("/customisation/addTitle/:id", protect, createTitle);
router.get("/customisation/getTitles/:id", protect, getTitlesByItemId);
router.patch('/itemById/:id', protect, deleteItemWithCustomisation);
router.get(
  "/customisation/getItemCustomisations/:id",
  protect,
  getTitlesWithOptionsByItemId
);
router.post("/customisation/addOption/:id", protect, createOption);
router.get("/customisation/getOptions/:id", getOptionsByTitleId);
router.patch("/customisation/checkTitleOptions/:id", checkTitlesWithNoOptions);
router.patch("/customisation/editOptions/:id", protect, updateOption);
router.patch("/customisation/addSelectionType/:id", protect, updateSelectionType);
router.delete("/customisation/discard/:id", protect, discardCustomizations);
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
