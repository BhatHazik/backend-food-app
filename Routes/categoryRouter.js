const express = require("express");
const {
  addCategoryById,
  getAllCategories,
  DeleteCategory,
  getAllMainCategories,
  editCategory,
} = require("../Controllers/categoriesController");
const { protect } = require("../Controllers/restaurantAuthController");
const userAuth = require("../Controllers/authController");
const { updateMainCategory, deleteMainCategory } = require("../Controllers/adminController");
const router = express.Router();

router.post("/", protect, addCategoryById);
router.get("/", protect, getAllCategories);
router.delete("/delete/:categoryId", protect, DeleteCategory);
router.patch('/updateCategory/:categoryId', protect, editCategory);
router.get("/getMainCategories", getAllMainCategories);
router.patch("/updateMainCategories/:id", userAuth.protectAdmin, updateMainCategory);
router.delete("deleteMainCategories/:id", userAuth.protectAdmin, deleteMainCategory);

module.exports = router;
