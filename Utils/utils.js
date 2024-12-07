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


  exports.calculateGrowthRate = (current, previous) => {
    // Handle the case where previous is zero to avoid division by zero
    if (previous === 0) {
      return current > 0 ? 100 : 0; // If current is greater than 0, growth is 100%; else, it's 0%.
    }
  
    // Calculate the growth rate
    const growthRate = ((current - previous) / previous) * 100;
  
    // Return the growth rate rounded to 2 decimal places
    return Math.round(growthRate * 100) / 100;
  };
  