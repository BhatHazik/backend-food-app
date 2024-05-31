const db = require('../Config/database');
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
const jwt = require('jsonwebtoken')
// CREATE Restaurant
exports.createRestaurant = async (req, res) => {
 
    const { owner_name, owner_phone_no, owner_email, restaurant_name, pan_no, GSTIN_no, FSSAI_no } = req.body;

    // Check if any required field is missing
    if (!owner_name || !owner_phone_no || !owner_email || !restaurant_name || !pan_no || !GSTIN_no || !FSSAI_no) {
      return next(new AppError(400, 'All fields are required')); 
    }

    const query = 'INSERT INTO restaurants (owner_name, owner_phone_no, owner_email, restaurant_name, pan_no, GSTIN_no, FSSAI_no) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const values = [owner_name, owner_phone_no, owner_email, restaurant_name, pan_no, GSTIN_no, FSSAI_no];
    const result = await db.query(query, values);

    const newRestaurant = {
      id: result.insertId,
      owner_name,
      owner_phone_no,
      owner_email,
      restaurant_name,
      pan_no,
      GSTIN_no,
      FSSAI_no,
      created_at: new Date(),
      updated_at: new Date()
    };

    res.status(201).json({
      status: 'Success',
      data: newRestaurant,
    });
 
};

// READ All Approved Restaurants
exports.getAllApprovedRestaurants = asyncChoke(async (req, res) => {
 
    const { latitude, longitude } = req.body;
    const radius = 5; // Radius in kilometers

    // Haversine formula to calculate distance
    const haversine = `(6371 * acos(cos(radians(${latitude})) * cos(radians(restaurantaddress.latitude)) * cos(radians(restaurantaddress.longitude) - radians(${longitude})) + sin(radians(${latitude})) * sin(radians(restaurantaddress.latitude))))`;

    // Query to get restaurants within the radius of the user's location
    const query = `
      SELECT restaurants.*, restaurantaddress.latitude AS restaurant_latitude, restaurantaddress.longitude AS restaurant_longitude, ${haversine} AS distance
      FROM restaurants
      INNER JOIN restaurantaddress ON restaurants.id = restaurantaddress.restaurant_id
      WHERE restaurants.approved = true AND ${haversine} <= ?
    `;

    const [rows, fields] = await db.query(query, [radius]);
    if(rows.length > 0){
      res.status(200).json({
      status: 'hgjhgkhSuccess',
      data: rows,
    });
    }
    return next(new AppError(404, "restaurants not found in your location"));
    
 
});
// READ Restaurant by ID
exports.getRestaurantById = asyncChoke(async (req, res) => {

    const { id } = req.params;
    const query = 'SELECT * FROM restaurants WHERE id = ?';
    const [rows, fields] = await db.query(query, [id]);
    
    if (!rows || rows.length === 0) {
      return next(new AppError(404, `Restaurant with id '${id}' not found`));
    }
    
    res.status(200).json({
      status: 'Success',
      data: rows[0],
    });
 
});
                
// UPDATE Restaurant
exports.updateRestaurant = asyncChoke(async (req, res) => {
  
    const { id } = req.params;
    const { owner_name, owner_phone_no, owner_email, restaurant_name } = req.body;
    const query = 'UPDATE restaurants SET owner_name = ?, owner_phone_no = ?, owner_email = ?, restaurant_name = ?, updated_at = ? WHERE id = ?';
    const values = [ owner_name, owner_phone_no, owner_email, restaurant_name , new Date(), id];
    const result = await db.query(query, values);
    if (result.affectedRows === 0) {
      return next(new AppError(404, `Restaurant with id '${id}' not found`));
    }
    res.status(200).json({
      status: 'Success',
      message: `Restaurant with id '${id}' updated successfully`,
    });
  
    
});

// DELETE Restaurant
exports.deleteRestaurant = asyncChoke(async (req, res) => {
 
    const { id } = req.params;
    const query = 'DELETE FROM restaurants WHERE id = ?';
    const result = await db.query(query, [id]);
    if (result.affectedRows === 0) {
      return next(new AppError(404, `Restaurant with id '${id}' not found`));
    }
    res.status(200).json({
      status: 'Success',
      message: `Restaurant with id '${id}' deleted successfully`,
    });
 
});





const createSendToken = (res, req, phone_no) => {
  const tokenOptions = { expiresIn: process.env.JWT_EXPIRY };
  const token = jwt.sign(
    { data: phone_no },
    process.env.JWT_SECRET,
    tokenOptions
  );
  return token;
}

// create otp on number
// createSellerOTP API
exports.sellerOTPsender = asyncChoke(async (req, res) => {
  
      const generateOTP = () => {
          return Math.floor(1000 + Math.random() * 9000);
      };

      const otp = generateOTP();
      const { phone_no } = req.body;
      // Check if phone_no is provided
      if (!phone_no) {
          return next(new AppError(400 , "Fill all fields"))
      }
      
      const [checkQuery] = await db.query(`SELECT * FROM otps WHERE phone_no = ?`, [phone_no]);
      
      if(checkQuery.length === 1){
          // Update OTP in the database for the provided phone number
      const query = `UPDATE otps SET otp = ? WHERE phone_no = ?`;
      const [result, fields] = await db.query(query, [otp, phone_no]);
      return res.status(200).json({ message: 'OTP sent successfully', otp });
      }
      const [insertQuery] = await db.query(`INSERT INTO otps (phone_no, otp) VALUES (?,?)`,[phone_no,otp])
      return res.status(200).json({ message: 'OTP sent successfully', otp });
  
});



exports.sellerLogin = asyncChoke(async (req, res) => {
  
      const { givenOTP } = req.body;
      const phone_no = req.params.phNO;

      // Check if givenOTP is provided
      if (!givenOTP) {
          return next(new AppError(400, 'OTP cannot be empty'));
      }
      if(!phone_no){
        return next(new AppError(400, 'Phone number cannot be empty'));
      }
      const [checkQuery] = await db.query(`SELECT * FROM restaurants WHERE owner_phone_no = ?`, [phone_no])
      if(checkQuery.length > 0){
        // Check if the provided OTP matches the OTP stored for the phone number
      const otpQuery = `
      SELECT COUNT(*) AS otp_matched
      FROM otps
      WHERE phone_no = ?
        AND otp = ?
  `;
  const [otpResult] = await db.query(otpQuery, [phone_no, givenOTP]);

  if (otpResult[0].otp_matched === 1) {

      const [sellerSignUp] = await db.query(`INSERT INTO restaurants (owner_phone_no) VALUES(?)`, [phone_no]);
      
      const token = createSendToken(res, req, phone_no);
      return res.status(200).json({ message: 'Login success', token });
  } else {
    return next(new AppError(401, 'Invalid OTP'));
  }
      }
      else{
        const otpQuery = `
      SELECT COUNT(*) AS otp_matched
      FROM otps
      WHERE phone_no = ?
        AND otp = ?
  `;
  const [otpResult] = await db.query(otpQuery, [phone_no, givenOTP]);

  if (otpResult[0].otp_matched === 1) {
      const token = createSendToken(res, req, phone_no);
      return res.status(200).json({ message: 'Login success', token });
  } else {
    return next(new AppError(401, 'Invalid OTP'))
  }
      }
      
 
});