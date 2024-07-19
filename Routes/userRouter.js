const express = require('express');
const userController = require('../Controllers/userController');
const userAuth = require('../Controllers/authController');
const router = express.Router();

// crud for users
router.post('/createUser', userController.createUserOTP);
router.post('/userSignUp/:phNO/:name/:email', userController.userSignUp);
router.get('/readUsers', userController.readUsers);
router.get('/getUserDetails',userAuth.protect, userController.getUserDetails);
router.patch('/updateUser', userController.updateUser);
router.delete('/deleteUser', userAuth.protect, userController.deleteUser);
router.post('/userSendOtp', userController.userOTPsender);
router.post('/userEditProfileOTP', userAuth.protect, userController.updateUserOtpSender);
router.patch('/editProfile/:name/:email/:phone_no',userAuth.protect, userController.updateUserProfile);
router.post('/addAddress', userAuth.protect, userController.addAddress);
router.get('/getUserAddresses', userAuth.protect , userController.getAddedAddress);
router.delete('/deleteAddress/:address_id', userAuth.protect, userController.removeAddress);
router.patch('/editAddress/:address_id',userAuth.protect,userController.editAddress);

module.exports = router;

