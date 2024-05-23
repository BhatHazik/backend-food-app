const express = require('express');
const deliveryBoyController = require('../Controllers/deliveryBoyController');

const router = express.Router();

router.post('/', deliveryBoyController.createDeleveryBoy);
router.get('/', deliveryBoyController.getAllApprovedDeliveryBoys);
router.get('/:id', deliveryBoyController.getApprovedDeliveryBoyById);
router.patch('/:id', deliveryBoyController.updateApprovedDeliveryBoy);
router.delete('/:id', deliveryBoyController.deleteApprovedDeliveryBoy);
router.post('/otp', deliveryBoyController.deliveryBoyOTPsender);
router.post('/check/otp/:phNO', deliveryBoyController.deliveryBoyLogin);

module.exports = router;
