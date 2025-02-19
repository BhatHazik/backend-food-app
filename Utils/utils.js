const jwt = require("jsonwebtoken");
const axios = require('axios');
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
    // If previous is 0 or undefined, handle it as 100% growth
    return current > 0 ? 100 : 0;
  }
  if (current === 0 && previous > 0) {
    // If current is 0 and previous is positive, return -100% (100% drop)
    return -100;
  }

  // Calculate the growth rate normally
  const growthRate = ((current - previous) / previous) * 100;

  // If the result is infinity, return 100%
  if (growthRate === Infinity) {
    return 100;
  }
  if(growthRate === NaN){
    return 0; // If growth rate is NaN, return 0% (no growth)
  }

  // Return the growth rate rounded to two decimal places
  return Math.round(growthRate * 100) / 100;
};



exports.convertExpiryDate = (valid) => {
  const [month, year] = valid.split("/");

  const fullYear = `20${year}`;

  return `${fullYear}-${month}-01`;
};




exports.getRouteDistance = async (originLat, originLng, destLat, destLng) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    try {
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&key=${apiKey}`;

        const response = await axios.get(url);
        const data = response.data;

        if (data.status === "OK") {
            const route = data.routes[0].legs[0];

            const distance = route.distance.text; // e.g., "10 km"
            const distanceValue = route.distance.value; // Distance in meters
            const duration = route.duration.text; // e.g., "15 mins"
            const durationValue = route.duration.value; // Duration in seconds

            return { distance, distanceValue, duration, durationValue };
        } else {
            throw new Error(`API Error: ${data.status} - ${data.error_message || "Failed to get route"}`);
        }
    } catch (error) {
        console.error("API request failed:", error.message);
        return null;
    }
};
