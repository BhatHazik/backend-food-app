const db = require('../Config/database');
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
const jwt = require('jsonwebtoken')
// CREATE Restaurant
exports.createRestaurant = async (req, res) => {
  try {
    const { owner_name, owner_phone_no, owner_email, restaurant_name, pan_no, GSTIN_no, FSSAI_no } = req.body;

    // Check if any required field is missing
    if (!owner_name || !owner_phone_no || !owner_email || !restaurant_name || !pan_no || !GSTIN_no || !FSSAI_no) {
      throw new AppError(400, 'All fields are required');
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
  } catch (error) {
    console.error('Error creating restaurant:', error);
    res.status(error.statusCode || 500).json({
      status: 'Error',
      message: error.message || 'Internal server error',
    });
  }
};

// READ All Approved Restaurants
exports.getAllApprovedRestaurants = asyncChoke(async (req, res) => {
  try {
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

    res.status(200).json({
      status: 'hgjhgkhSuccess',
      data: rows,
    });
  } catch (error) {
    console.error('Error fetching restaurants near user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// READ Restaurant by ID
exports.getRestaurantById = asyncChoke(async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'SELECT * FROM restaurants WHERE id = ?';
    const [rows, fields] = await db.query(query, [id]);
    
    if (!rows || rows.length === 0) {
      throw new AppError(404, `Restaurant with id '${id}' not found`);
    }
    
    res.status(200).json({
      status: 'Success',
      data: rows[0],
    });
  } catch (error) {
    console.error('Error getting restaurant by ID:', error);
    throw new AppError(error.statusCode || 500, error.message || 'Internal server error');
  }
});
                
// UPDATE Restaurant
exports.updateRestaurant = asyncChoke(async (req, res) => {
  
    const { id } = req.params;
    const { owner_name, owner_phone_no, owner_email, restaurant_name } = req.body;
    const query = 'UPDATE restaurants SET owner_name = ?, owner_phone_no = ?, owner_email = ?, restaurant_name = ?, updated_at = ? WHERE id = ?';
    const values = [ owner_name, owner_phone_no, owner_email, restaurant_name , new Date(), id];
    const result = await db.query(query, values);
    if (result.affectedRows === 0) {
      throw new AppError(404, `Restaurant with id '${id}' not found`);
    }
    res.status(200).json({
      status: 'Success',
      message: `Restaurant with id '${id}' updated successfully`,
    });
  
    if(1)
    return next( new AppError(400,'Internal server error'));
});

// DELETE Restaurant
exports.deleteRestaurant = asyncChoke(async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'DELETE FROM restaurants WHERE id = ?';
    const result = await db.query(query, [id]);
    if (result.affectedRows === 0) {
      throw new AppError(404, `Restaurant with id '${id}' not found`);
    }
    res.status(200).json({
      status: 'Success',
      message: `Restaurant with id '${id}' deleted successfully`,
    });
  } catch (error) {
    console.error('Error deleting restaurant:', error);
    throw new AppError(error.statusCode || 500, error.message || 'Internal server error');
  }
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
exports.sellerOTPsender = async (req, res) => {
  try {
      const generateOTP = () => {
          return Math.floor(1000 + Math.random() * 9000);
      };

      const otp = generateOTP();
      const { phone_no } = req.body;
      // Check if phone_no is provided
      if (!phone_no) {
          return res.status(400).json({ error: "Fill all fields" });
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
  } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Internal server error' });
  }
};



exports.sellerLogin = async (req, res) => {
  try {
      const { givenOTP } = req.body;
      const phone_no = req.params.phNO;

      // Check if givenOTP is provided
      if (!givenOTP) {
          return res.status(400).json({ message: 'OTP cannot be empty' });
      }
      if(!phone_no){
          return res.status(400).json({message:"phone_no can't be empty"})
      }
      const [checkQuery] = await db.query(`SELECT * FROM restaurants WHERE owner_phone_no = ?`, [phone_no])
      if(checkQuery.length > 1){
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
      return res.status(401).json({ message: 'Invalid OTP' });
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
      return res.status(401).json({ message: 'Invalid OTP' });
  }
      }
      
  } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Internal server error' });
  }
};