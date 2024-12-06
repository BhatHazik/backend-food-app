const express = require('express');
const { getDocumentStatus, deliveryBoyOTPsender, deliveryBoyLogin, createDeleveryBoy, getAllApprovedDeliveryBoys, getApprovedDeliveryBoyById, updateApprovedDeliveryBoy, deleteApprovedDeliveryBoy, deliveryOTPsender, deliveryLogin, updateDeliveryPersonal, updateDeliveryDocs, updateWorkType, updateDeliveryVehicle, updateDeliveryBank, sendApprovalRequest } = require('../Controllers/deliveryBoyController');
const { protect } = require('../Controllers/deliveryAuth');

const router = express.Router();

router.get('/getDocsStatus', protect, getDocumentStatus);
router.post('/deliverySendOtp', deliveryOTPsender);
router.post('/deliveryLogin/:phNO', deliveryLogin);
router.patch('/infoUpdate',protect, updateDeliveryPersonal);
router.patch('/docsUpdate',protect, updateDeliveryDocs);
router.patch('/workUpdate',protect, updateWorkType);
router.patch('/vehicleUpdate', protect,updateDeliveryVehicle);
router.patch('/bankUpdate',protect, updateDeliveryBank);
router.patch('/sendForApproval', protect, sendApprovalRequest);

router.post('/', createDeleveryBoy);
router.get('/', getAllApprovedDeliveryBoys);
router.get('/:id', getApprovedDeliveryBoyById);

router.delete('/:id', deleteApprovedDeliveryBoy);
router.post('/otp', deliveryBoyOTPsender);
router.post('/check/otp/:phNO', deliveryBoyLogin);

module.exports = router;
