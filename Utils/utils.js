exports.isValidPhoneNumber = function(phoneNo) {
    const phoneRegex = /^\d{10}$/;
    return phoneRegex.test(phoneNo);
  };