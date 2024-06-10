const express = require('express');
const menuController = require('../Controllers/menuController');
const userAuth = require('../Controllers/authController')
const router = express.Router();

router.post('/:id', menuController.createMenu);
// router.get('/:id', menuController.getAllMenus);
router.get('/:id/:latitude/:longitude',userAuth.protect, menuController.getMenuById);
// router.patch('/:id', menuController.updateMenuItem);
// router.delete('/:id', menuController.deleteMenuItem);

module.exports = router;
