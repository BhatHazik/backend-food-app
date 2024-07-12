const express = require('express');
const itemController = require('../Controllers/itemController');
const auth = require('../Controllers/authController');
const router = express.Router();

router.post('/:id', itemController.createItem);
router.get('/:id', itemController.readItems);
router.post('/customisation/addTitle/:id', itemController.createTitle);
router.get('/customisation/getTitles/:id', itemController.getTitlesByItemId);
router.post('/customisation/addOption/:id', itemController.createOption);
router.get('/customisation/getOptions/:id', itemController.getOptionsByTitleId);
router.get('/customisation/checkTitleOptions/:id', itemController.checkTitlesWithNoOptions);
router.patch('/customisation/editOptions/:id', itemController.updateOption);
router.patch('/customisation/addSelectionType/:id', itemController.updateSelectionType);
router.delete('/customisation/discard/:id', itemController.discardCustomizations);

// user router
router.get('/customisation/getCustomisation/:id', auth.protect,itemController.getCustomizations);
router.post('/customisation/setUserCustomisation/:id', auth.protect,itemController.submitCustomizations);
router.get('/customisation/getSelectedCustomisation/:id', auth.protect,itemController.getSelectedCustomizations);
router.patch('/customisation/updateSelectedCustomisation/:id', auth.protect,itemController.updateItemCustomizations);


module.exports = router;
