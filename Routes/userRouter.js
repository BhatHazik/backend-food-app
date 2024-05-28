const express = require('express');
const userController = require('../Controllers/userController')

const router = express.Router();

// crud for users
router.post('/createUser', userController.createUserOTP);
router.post('/userSignUp/:phNO', userController.userSignUp);
router.get('/readUsers', userController.readUsers);
router.patch('/updateUser', userController.updateUser);
router.delete('/deleteUser', userController.deleteUser);
router.post('/userSendOtp', userController.userOTPsender);
router.post('/userLogin/:phNO', userController.userLogin);




module.exports = router;

