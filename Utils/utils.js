const jwt = require('jsonwebtoken')

exports.isValidPhoneNumber = function(phoneNo) {
    const phoneRegex = /^\d{10}$/;
    return phoneRegex.test(phoneNo);
  };

 exports.createSendToken = (res, req, phone_no) => {
    const tokenOptions = { expiresIn: process.env.JWT_EXPIRY };
    const token = jwt.sign(
      { data: phone_no },
      process.env.JWT_SECRET,
      tokenOptions
    );
    return token;
  };