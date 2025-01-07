const express = require("express");
const {
  getRestaurantsAdmin,
  approveRestaurants,
  getDeleveryBoysAdmin,
  approveDeleveryBoys,
  createMainCategory,
  updateMainCategory,
  deleteMainCategory,
  adminLogin,
  getAdminDashboard,
  updateAppSettings,
} = require("../Controllers/adminController");
const { protectAdmin } = require("../Controllers/authController");

const router = express.Router();

router.get("/unApprovedRestaurants", protectAdmin, getRestaurantsAdmin);
router.get("/dashboard", protectAdmin, getAdminDashboard);
router.patch("/approveRestaurant/:id", protectAdmin, approveRestaurants);
router.get("/getAllDeleveryBoys", protectAdmin, getDeleveryBoysAdmin);
router.patch("/approveDeleveryBoy/:id", protectAdmin, approveDeleveryBoys);
router.patch("/approveDeleveryBoy/:id", protectAdmin, approveDeleveryBoys);
router.post("/createCategory", protectAdmin, createMainCategory);
router.patch("/updateCategory/:id", protectAdmin, updateMainCategory);
router.delete("/deleteCategory", protectAdmin, deleteMainCategory);
router.post('/login', adminLogin);
router.patch('/appSettings', protectAdmin, updateAppSettings);

module.exports = router;
