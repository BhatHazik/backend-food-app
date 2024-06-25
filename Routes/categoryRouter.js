const express = require('express');
const CategoriesController = require('../Controllers/categoriesController');
const sellerAuth = require('../Controllers/restaurantAuthController')
const router = express.Router();


router.post('/', sellerAuth.protect, CategoriesController.addCategoryById);
router.get('/',sellerAuth.protect, CategoriesController.getAllCategories);


module.exports = router;