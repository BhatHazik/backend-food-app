const jwt = require('jsonwebtoken')

exports.isValidPhoneNumber = function(phoneNo) {
    const phoneRegex = /^\d{10}$/;
    return phoneRegex.test(phoneNo);
  };

 exports.createSendToken = (res, req, phone_no, role) => {
  console.log(role);
    const tokenOptions = { expiresIn: process.env.JWT_EXPIRY };
    const token = jwt.sign(
      { data: phone_no , role: role},
      process.env.JWT_SECRET,
      tokenOptions
    );
    return token;
  };


  exports.calculateGrowthRate = (current, previous) => {
    // Handle edge cases explicitly
    if (previous === 0 || previous === null || previous === undefined) {
      return current > 0 ? 100 : 0; // If there's no previous value, assume 100% growth if current is positive.
    }
    if (current === 0 && previous > 0) {
      return -100; // If current is 0 but there was a previous value, it's a -100% decline.
    }
  
    // Calculate growth rate
    const growthRate = ((current - previous) / previous) * 100;
  
    // Round to 2 decimal places and return
    return Math.round(growthRate * 100) / 100;
  };
  



exports.convertExpiryDate = (valid) => {
    // Split MM/YY
    const [month, year] = valid.split('/');

    // Convert YY to YYYY
    const fullYear = `20${year}`;

    // Return in YYYY-MM-01 format
    return `${fullYear}-${month}-01`;
}