const express = require('express');
const itemController = require('../Controllers/itemController');

const router = express.Router();

router.post('/', itemController.createItem);
router.get('/', itemController.readItems);
router.patch('/:id', itemController.updateItem);
router.delete('/:id', itemController.deleteItem);

module.exports = router;
