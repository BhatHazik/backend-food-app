const express = require('express');
const CategoriesController = require('../Controllers/categoriesController');

const router = express.Router();


router.post('/:id', CategoriesController.addCategoryById);
router.get('/:id', CategoriesController.getAllCategories);


module.exports = router;