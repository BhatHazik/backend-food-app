const express = require('express');
const menuController = require('../Controllers/menuController');

const router = express.Router();

router.post('/:id', menuController.createMenu);
router.get('/:id', menuController.getAllMenus);
router.get('/byId/:id', menuController.getMenuById);
// router.patch('/:id', menuController.updateMenuItem);
// router.delete('/:id', menuController.deleteMenuItem);

module.exports = router;
