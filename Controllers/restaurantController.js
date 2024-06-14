const db = require("../Config/database");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
const jwt = require("jsonwebtoken");
// CREATE Restaurant
exports.createRestaurant = asyncChoke(async (req, res, next) => {
  const {
    owner_name,
    owner_phone_no,
    owner_email,
    restaurant_name,
    pan_no,
    GSTIN_no,
    FSSAI_no,
    outlet_type,
    bank_IFSC,
    bank_account_no,
    street,
    landmark,
    area,
    pincode,
    city,
    state,
    latitude,
    longitude,
    monday,
    tuesday,
    wednesday,
    thursday,
    friday,
    saturday,
    sunday,
    opening_time,
    closing_time,
  } = req.body;

  // Check if any required field is missing
  if (
    !owner_name ||
    !owner_phone_no ||
    !owner_email ||
    !restaurant_name ||
    !pan_no ||
    !GSTIN_no ||
    !FSSAI_no ||
    !outlet_type ||
    !bank_IFSC ||
    !bank_account_no ||
    !street ||
    !landmark ||
    !area ||
    !pincode ||
    !city ||
    !state ||
    !latitude ||
    !longitude ||
    monday == null ||
    tuesday == null ||
    wednesday == null ||
    thursday == null ||
    friday == null ||
    saturday == null ||
    sunday == null ||
    !opening_time  ||
    !closing_time 
  ) {
    return next(new AppError(400, "All fields are required"));
  }
  
  const LoginNumber = req.user.owner_phone_no;
  if(LoginNumber !== owner_phone_no){
    return next(new AppError(404, 'Please enter same number given at login'));
  }
  
  const [checkQuery1] = await db.query(
    `SELECT * FROM restaurants WHERE GSTIN_no = ? OR FSSAI_no = ? OR pan_no = ? AND approved = ?`,
    [GSTIN_no, FSSAI_no, pan_no, false]
  );

  if (checkQuery1.length > 0) {
    return next(new AppError(409, 'Given Documents are in a pending approval check'));
  }
  
   const query =
    `UPDATE restaurants SET 
    owner_name = ?, 
    owner_email = ?, 
    restaurant_name = ?, 
    pan_no = ?, 
    GSTIN_no = ?, 
    FSSAI_no = ?, 
    outlet_type = ?, 
    bank_IFSC = ?, 
    bank_account_no = ? 
  WHERE owner_phone_no = ?
  `;
  const values = [
    owner_name,
    owner_email,
    restaurant_name,
    pan_no,
    GSTIN_no,
    FSSAI_no,
    outlet_type,
    bank_IFSC,
    bank_account_no,
    owner_phone_no
  ];
  const [result] = await db.query(query, values);
  if(result.affectedRows === 0 ){
    return next(new AppError(401, "error while creating your restaurant"));
  }
  
  const newRestaurant = {
    id: result.insertId,
    owner_name,
    owner_email,
    restaurant_name,
    pan_no,
    GSTIN_no,
    FSSAI_no,
    outlet_type,
    bank_IFSC,
    bank_account_no,
    owner_phone_no,
    created_at: new Date(),
    updated_at: new Date(),
  };
  const [checkQuery] = await db.query(`SELECT * FROM restaurants WHERE owner_phone_no = ?`, [owner_phone_no]);
  const restaurant_id = checkQuery[0].id
  
  const workingQuery = await db.query(`INSERT INTO restaurants_working (monday,
                                                                tuesday,
                                                                wednesday,
                                                                thursday,
                                                                friday,
                                                                saturday,
                                                                sunday,
                                                                opening_time,
                                                                closing_time,
                                                                restaurant_id) VALUES (
                                                                  ?,?,?,?,?,?,?,?,?,?
                                                                )`,[monday,
                                                                                tuesday,
                                                                                wednesday,
                                                                                thursday,
                                                                                friday,
                                                                                saturday,
                                                                                sunday,
                                                                                opening_time,
                                                                                closing_time,
                                                                                restaurant_id])
  const addressQuery = await db.query(`INSERT INTO restaurantaddress (street,
    landmark,
    area,
    pincode,
    city,
    state,
    latitude,
    longitude,
    restaurant_id) VALUES(
      ?,?,?,?,?,?,?,?,?
    )`,[street,
      landmark,
      area,
      pincode,
      city,
      state,
      latitude,
      longitude,
      restaurant_id]);

  res.status(201).json({
    status: "Success",
    message: "Your restaurant's checking approval is under process. It may take up to 6 - 7 working days"
  });
});

// READ All Approved Restaurants
exports.getAllApprovedRestaurants = asyncChoke(async (req, res, next) => {
  const { latitude, longitude } = req.params;
  const radius = 5; // Radius in kilometers
  const cookingPackingTime = 10; // Fixed 10 minutes for cooking and packing
  const averageSpeed = 0.5; // 30 km/h = 0.5 km/min
  const bufferTime = 5; // Buffer time in minutes for range

  // Haversine formula to calculate distance
  const haversine = `(6371 * acos(cos(radians(${latitude})) * cos(radians(restaurantaddress.latitude)) * cos(radians(restaurantaddress.longitude) - radians(${longitude})) + sin(radians(${latitude})) * sin(radians(restaurantaddress.latitude))))`;

  // Query to get restaurants within the radius of the user's location and their average ratings
  const query = `
    SELECT 
      restaurants.id AS restaurant_id, 
      restaurants.restaurant_name, 
      ${haversine} AS distance, 
      COALESCE(AVG(restaurants_rating.rating), 0) AS avg_rating
    FROM 
      restaurants
    INNER JOIN 
      restaurantaddress ON restaurants.id = restaurantaddress.restaurant_id
    LEFT JOIN 
      restaurants_rating ON restaurants.id = restaurants_rating.restaurant_id
    WHERE 
      restaurants.approved = true AND ${haversine} <= ?
    GROUP BY 
      restaurants.id, restaurants.restaurant_name, restaurantaddress.latitude, restaurantaddress.longitude
    ORDER BY 
      avg_rating DESC;
  `;

  const [rows, fields] = await db.query(query, [radius]);

  if (rows.length > 0) {
    const data = rows.map(row => {
      const travelTime = row.distance / averageSpeed; // Calculate travel time
      const minTime = travelTime - bufferTime + cookingPackingTime; // Minimum time
      const maxTime = travelTime + bufferTime + cookingPackingTime; // Maximum time

      return {
        restaurant_id: row.restaurant_id,
        restaurant_name: row.restaurant_name,
        distance: row.distance,
        avg_rating: parseFloat(row.avg_rating).toFixed(1),
        delivery_time: `${Math.max(0, Math.floor(minTime))} - ${Math.ceil(maxTime)} min`
      };
    });

    res.status(200).json({
      status: "Success",
      data,
    });
  } else {
    return next(new AppError(404, "Restaurants not found in your location"));
  }
});

exports.getAllTopRatedRestaurants = asyncChoke(async (req, res, next) => {
  const { latitude, longitude } = req.params;
  const radius = 5; // Radius in kilometers
  const cookingPackingTime = 10; // Fixed 10 minutes for cooking and packing
  const averageSpeed = 0.5; // 30 km/h = 0.5 km/min
  const bufferTime = 5; // Buffer time in minutes for range

  // Haversine formula to calculate distance
  const haversine = `(6371 * acos(cos(radians(${latitude})) * cos(radians(restaurantaddress.latitude)) * cos(radians(restaurantaddress.longitude) - radians(${longitude})) + sin(radians(${latitude})) * sin(radians(restaurantaddress.latitude))))`;

  // Query to get restaurants within the radius of the user's location with ratings above 4.0
  const query = `
    SELECT 
      restaurants.id AS restaurant_id, 
      restaurants.restaurant_name, 
      ${haversine} AS distance, 
      COALESCE(AVG(restaurants_rating.rating), 0) AS avg_rating
    FROM 
      restaurants
    INNER JOIN 
      restaurantaddress ON restaurants.id = restaurantaddress.restaurant_id
    LEFT JOIN 
      restaurants_rating ON restaurants.id = restaurants_rating.restaurant_id
    WHERE 
      restaurants.approved = true AND ${haversine} <= ?
    GROUP BY 
      restaurants.id, restaurants.restaurant_name, restaurantaddress.latitude, restaurantaddress.longitude
    HAVING 
      COALESCE(AVG(restaurants_rating.rating), 0) > 4.0
    ORDER BY 
      avg_rating DESC;
  `;

  const [rows, fields] = await db.query(query, [radius]);

  if (rows.length > 0) {
    const data = rows.map(row => {
      const travelTime = row.distance / averageSpeed; // Calculate travel time
      const minTime = travelTime - bufferTime + cookingPackingTime; // Minimum time
      const maxTime = travelTime + bufferTime + cookingPackingTime; // Maximum time

      return {
        restaurant_id: row.restaurant_id,
        restaurant_name: row.restaurant_name,
        distance: row.distance,
        avg_rating: parseFloat(row.avg_rating).toFixed(1),
        delivery_time: `${Math.max(0, Math.floor(minTime))} - ${Math.ceil(maxTime)} min`
      };
    });

    res.status(200).json({
      status: "Success",
      data,
    });
  } else {
    return next(new AppError(404, "Restaurants not found in your location with ratings above 4.0"));
  }
});

exports.getAllPopularRestaurants = asyncChoke(async (req, res, next) => {
  const { latitude, longitude } = req.params;
  const radius = 5; // Radius in kilometers
  const cookingPackingTime = 10; // Fixed 10 minutes for cooking and packing
  const averageSpeed = 0.5; // 30 km/h = 0.5 km/min
  const bufferTime = 5; // Buffer time in minutes for range

  // Haversine formula to calculate distance
  const haversine = `(6371 * acos(cos(radians(${latitude})) * cos(radians(restaurantaddress.latitude)) * cos(radians(restaurantaddress.longitude) - radians(${longitude})) + sin(radians(${latitude})) * sin(radians(restaurantaddress.latitude))))`;

  // Query to get restaurants within the radius of the user's location, ordered by order_count descending
  const query = `
    SELECT 
      restaurants.id AS restaurant_id, 
      restaurants.restaurant_name, 
      ${haversine} AS distance, 
      COALESCE(AVG(restaurants_rating.rating), 0) AS avg_rating,
      restaurants.order_count
    FROM 
      restaurants
    INNER JOIN 
      restaurantaddress ON restaurants.id = restaurantaddress.restaurant_id
    LEFT JOIN 
      restaurants_rating ON restaurants.id = restaurants_rating.restaurant_id
    WHERE 
      restaurants.approved = true AND ${haversine} <= ?
    GROUP BY 
      restaurants.id, restaurants.restaurant_name, restaurantaddress.latitude, restaurantaddress.longitude
    ORDER BY 
      restaurants.order_count DESC, avg_rating DESC;
  `;

  const [rows, fields] = await db.query(query, [radius]);

  if (rows.length > 0) {
    const data = rows.map(row => {
      const travelTime = row.distance / averageSpeed; // Calculate travel time
      const minTime = travelTime - bufferTime + cookingPackingTime; // Minimum time
      const maxTime = travelTime + bufferTime + cookingPackingTime; // Maximum time

      return {
        restaurant_id: row.restaurant_id,
        restaurant_name: row.restaurant_name,
        distance: row.distance,
        avg_rating: parseFloat(row.avg_rating).toFixed(1),
        delivery_time: `${Math.max(0, Math.floor(minTime))} - ${Math.ceil(maxTime)} min`
      };
    });

    res.status(200).json({
      status: "Success",
      data,
    });
  } else {
    return next(new AppError(404, "Restaurants not found in your location"));
  }
});

exports.getAllRestaurantsByCategories = asyncChoke(async (req, res, next) => {
  const { latitude, longitude, categoryName } = req.params;

  const radius = 5; // Radius in kilometers
  const cookingPackingTime = 10; // Fixed 10 minutes for cooking and packing
  const averageSpeed = 0.5; // 30 km/h = 0.5 km/min
  const bufferTime = 5; // Buffer time in minutes for range

  // Haversine formula to calculate distance
  const haversine = `(6371 * acos(cos(radians(${latitude})) * cos(radians(restaurantaddress.latitude)) * cos(radians(restaurantaddress.longitude) - radians(${longitude})) + sin(radians(${latitude})) * sin(radians(restaurantaddress.latitude))))`;

  // Query to get restaurants within the radius of the user's location and their average ratings, filtered by category
  const query = `
    SELECT 
      restaurants.id AS restaurant_id, 
      restaurants.restaurant_name, 
      ${haversine} AS distance, 
      COALESCE(AVG(restaurants_rating.rating), 0) AS avg_rating
    FROM 
      restaurants
    INNER JOIN 
      restaurantaddress ON restaurants.id = restaurantaddress.restaurant_id
    LEFT JOIN 
      restaurants_rating ON restaurants.id = restaurants_rating.restaurant_id
    INNER JOIN 
      menus ON restaurants.id = menus.restaurant_id
    INNER JOIN 
      categories ON menus.id = categories.menu_id
    WHERE 
      restaurants.approved = true 
      AND ${haversine} <= ?
      AND categories.category = ?
    GROUP BY 
      restaurants.id, restaurants.restaurant_name, restaurantaddress.latitude, restaurantaddress.longitude
    ORDER BY 
      avg_rating DESC;
  `;

  const [rows, fields] = await db.query(query, [radius, categoryName]);

  if (rows.length > 0) {
    const data = rows.map(row => {
      const travelTime = row.distance / averageSpeed; // Calculate travel time
      const minTime = travelTime - bufferTime + cookingPackingTime; // Minimum time
      const maxTime = travelTime + bufferTime + cookingPackingTime; // Maximum time

      return {
        restaurant_id: row.restaurant_id,
        restaurant_name: row.restaurant_name,
        distance: row.distance,
        avg_rating: parseFloat(row.avg_rating).toFixed(1),
        delivery_time: `${Math.max(0, Math.floor(minTime))} - ${Math.ceil(maxTime)} min`
      };
    });

    res.status(200).json({
      status: "Success",
      data,
    });
  } else {
    return next(new AppError(404, "Restaurants not found with this category in your location!"));
  }
});

// exports.getAllRestaurantsByCategories = asyncChoke(async(req,res,next)=>{
//   const {categoryName} = req.body;
//   const query = `SELECT * FROM categories WHERE category = ?`
//   const values = [categoryName]
//   const rows = await db.query(query,values);
//   if
// })


// READ Restaurant by ID
exports.getRestaurantById = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  const query = "SELECT * FROM restaurants WHERE id = ? AND approved = ?";
  const [rows, fields] = await db.query(query, [id, true]);

  if (!rows || rows.length === 0) {
    return next(new AppError(404, `Restaurant with id '${id}' not found`));
  }
  

  res.status(200).json({
    status: "Success",
    data: rows[0],
  });
});

// UPDATE Restaurant
exports.updateRestaurant = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  const { owner_name, owner_phone_no, owner_email, restaurant_name } = req.body;
  const query =
    "UPDATE restaurants SET owner_name = ?, owner_phone_no = ?, owner_email = ?, restaurant_name = ?, updated_at = ? WHERE id = ?";
  const values = [
    owner_name,
    owner_phone_no,
    owner_email,
    restaurant_name,
    new Date(),
    id,
  ];
  const result = await db.query(query, values);
  if (result.affectedRows === 0) {
    return next(new AppError(404, `Restaurant with id '${id}' not found`));
  }
  res.status(200).json({
    status: "Success",
    message: `Restaurant with id '${id}' updated successfully`,
  });
});

// DELETE Restaurant
exports.deleteRestaurant = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  const query = "DELETE FROM restaurants WHERE id = ?";
  const result = await db.query(query, [id]);
  if (result.affectedRows === 0) {
    return next(new AppError(404, `Restaurant with id '${id}' not found`));
  }
  res.status(200).json({
    status: "Success",
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
};

// create otp on number
// createSellerOTP API
exports.sellerOTPsender = asyncChoke(async (req, res, next) => {
  const generateOTP = () => {
    return Math.floor(1000 + Math.random() * 9000);
  };

  const otp = generateOTP();
  let { phone_no } = req.body;
  phone_no = String(phone_no).trim();

  
  // Check if phone_no is provided
  if (!phone_no) {
    return next(new AppError(400, "Fill all fields"));
  }
 


  // Check if phone_no is provided and has exactly 10 digits
  if (!phone_no || phone_no.length !== 10 || !/^\d{10}$/.test(phone_no)) {
    return next(new AppError(400, "Please enter a valid 10-digit phone number!"));
  }
  const [checkQuery] = await db.query(`SELECT * FROM otps WHERE phone_no = ?`, [
    phone_no,
  ]);

  if (checkQuery.length === 1) {
    // Update OTP in the database for the provided phone number
    const query = `UPDATE otps SET otp = ? WHERE phone_no = ?`;
    const [result, fields] = await db.query(query, [otp, phone_no]);
    return res.status(200).json({ message: "OTP sent successfully", otp });
  }
  const [insertQuery] = await db.query(
    `INSERT INTO otps (phone_no, otp) VALUES (?,?)`,
    [phone_no, otp]
  );
  return res
    .status(200)
    .json({ message: "OTP sent successfully", otp, phone_no });
});


exports.sellerLogin = asyncChoke(async (req, res, next) => {
  const { givenOTP } = req.body;
  const phone_no = req.params.phNO;
 
  // Check if givenOTP is provided
  if (!givenOTP) {
    return next(new AppError(400, "OTP cannot be empty"));
  }
  if (!phone_no) {
    return next(new AppError(400, "Phone number cannot be empty"));
  }
  const [checkQuery] = await db.query(
    `SELECT * FROM restaurants WHERE owner_phone_no = ?`,
    [phone_no]
  );
  if (checkQuery.length > 0) {
    // Check if the provided OTP matches the OTP stored for the phone number
    const otpQuery = `
      SELECT COUNT(*) AS otp_matched
      FROM otps
      WHERE phone_no = ?
        AND otp = ?
  `;
    const [otpResult] = await db.query(otpQuery, [phone_no, givenOTP]);

    if (otpResult[0].otp_matched === 1) {

      const token = createSendToken(res, req, phone_no);
      return res.status(200).json({ message: "Login success", token });
      
    } else {
      return next(new AppError(401, "Invalid OTP"));
    }
  } else {
    const otpQuery = `
      SELECT COUNT(*) AS otp_matched
      FROM otps
      WHERE phone_no = ?
        AND otp = ?
  `;
    const [otpResult] = await db.query(otpQuery, [phone_no, givenOTP]);

    if (otpResult[0].otp_matched === 1) {
      const [sellerSignUp] = await db.query(
        `INSERT INTO restaurants (owner_phone_no) VALUE(?)`,
        [phone_no]
      );
      const token = createSendToken(res, req, phone_no);
      return res.status(200).json({ message: "Account created successfully", token });
    } else {
      return next(new AppError(401, "Invalid OTP"));
    }
  }
});
