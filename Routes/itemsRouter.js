const express = require('express');

const itemController = require('../Controllers/itemController')
const router = express.Router();


router.post('/createItem', itemController.createItem);
router.get('/readItems', itemController.readItems);
router.patch('/updateItem', itemController.updateItem);
router.delete('/deleteItem', itemController.deleteItem);





module.exports = router;