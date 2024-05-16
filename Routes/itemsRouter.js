const express = require('express');
const itemController = require('../Controllers/itemController');

const router = express.Router();

router.post('/:id', itemController.createItem);
// router.get('/', itemController.readItems);
router.patch('/:id', itemController.updateItembyid);
router.delete('/:id', itemController.deleteItem);

module.exports = router;
