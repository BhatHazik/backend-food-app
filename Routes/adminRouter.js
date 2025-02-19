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
  getAppSettings,
} = require("../Controllers/adminController");
const { protectAdmin } = require("../Controllers/authController");
const upload = require("multer")();
const router = express.Router();

router.get("/unApprovedRestaurants", protectAdmin, getRestaurantsAdmin);
router.get("/appSettings" ,protectAdmin, getAppSettings);
router.get("/dashboard", protectAdmin, getAdminDashboard);
router.patch("/approveRestaurant/:id", protectAdmin, approveRestaurants);
router.get("/getAllDeleveryBoys", protectAdmin, getDeleveryBoysAdmin);
router.patch("/approveDeleveryBoy/:id", protectAdmin, approveDeleveryBoys);
router.patch("/approveDeleveryBoy/:id", protectAdmin, approveDeleveryBoys);
router.post("/createCategory", protectAdmin,
  upload.fields([{ name: "thumbnail", maxCount: 1 }]), createMainCategory);
router.patch("/updateCategory/:id", protectAdmin,
  upload.fields([{ name: "thumbnail", maxCount: 1 }]), updateMainCategory);
router.delete("/deleteCategory/:id", protectAdmin, deleteMainCategory);
router.post('/login', adminLogin);
router.patch('/appSettings', protectAdmin, updateAppSettings);

module.exports = router;
