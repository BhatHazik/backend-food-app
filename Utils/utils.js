const jwt = require("jsonwebtoken");

exports.isValidPhoneNumber = function (phoneNo) {
  const phoneRegex = /^\d{10}$/;
  return phoneRegex.test(phoneNo);
};

exports.createSendToken = (res, req, phone_no, role) => {
  const tokenOptions = { expiresIn: process.env.JWT_EXPIRY };
  const token = jwt.sign(
    { data: phone_no, role: role },
    process.env.JWT_SECRET,
    tokenOptions
  );
  return token;
};

exports.validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

exports.calculateGrowthRate = (current, previous) => {
  if (previous === 0 || previous === null || previous === undefined) {
    return current > 0 ? 100 : 0;
  }
  if (current === 0 && previous > 0) {
    return -100;
  }

  const growthRate = ((current - previous) / previous) * 100;

  return Math.round(growthRate * 100) / 100;
};

exports.convertExpiryDate = (valid) => {
  const [month, year] = valid.split("/");

  const fullYear = `20${year}`;

  return `${fullYear}-${month}-01`;
};
