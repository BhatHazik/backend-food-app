const express = require('express');
const { addCategoryById, getAllCategories, DeleteCategory, getAllMainCategories } = require('../Controllers/categoriesController');
const {protect} = require('../Controllers/restaurantAuthController')
const userAuth = require('../Controllers/authController');
const router = express.Router();


router.post('/', protect, addCategoryById);
router.get('/',protect, getAllCategories);
router.delete('/delete/:categoryId', protect, DeleteCategory);
router.get('/getMainCategories', userAuth.protect, getAllMainCategories);

module.exports = router;