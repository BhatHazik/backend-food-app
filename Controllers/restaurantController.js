const { pool } = require("../Config/database");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
const jwt = require("jsonwebtoken");
const { isValidPhoneNumber, calculateGrowthRate } = require("../Utils/utils");
// CREATE Restaurant
exports.createRestaurant = asyncChoke(async (req, res, next) => {
  const {id:restaurant_id, approved} = req.user;
  console.log(req.body);
  const {
    owner_name,
    owner_phone_no,
    owner_email,
    restaurant_name,
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
    !opening_time ||
    !closing_time
  ) {
    return next(new AppError(400, "All fields are required"));
  }
  // console.log(req.body);

  const LoginNumber = req.user.owner_phone_no;
  console.log(LoginNumber,owner_phone_no);
  if (LoginNumber !== owner_phone_no) {
    return next(new AppError(404, "Please enter same number given at login"));
  }

  
  
  // const [docExists] = await pool.query(`SELECT * FROM restaurant_docs WHERE restaurant_id = ?`, [restaurant_id]);
  // if(docExists.length > 0){
  //   return next(new AppError(409, "Documents already exists"));
  // }
 

  
// console.log(approved);
//   if (approved === 0) {
//     return next(
//       new AppError(409, "This Restaurant is in a pending approval check")
//     );
//   }
//   if(approved === 1) {
//     return next(new AppError(409, "Restaurant already has been approved"));
//   }

  const query = `UPDATE restaurants SET 
    owner_name = ?, 
    owner_email = ?, 
    restaurant_name = ?
  WHERE owner_phone_no = ?
  `;
  const values = [
    owner_name,
    owner_email,
    restaurant_name,
    owner_phone_no,
  ];
  const [result] = await pool.query(query, values);
  if (result.affectedRows === 0) {
    return next(new AppError(401, "error while creating your restaurant"));
  }



  

  //   const newRestaurant = {
  //   id: result.insertId,
  //   owner_name,
  //   owner_email,
  //   restaurant_name,
  //   pan_no,
  //   GSTIN_no,
  //   FSSAI_no,
  //   outlet_type,
  //   bank_IFSC,
  //   bank_account_no,
  //   owner_phone_no,
  //   created_at: new Date(),
  //   updated_at: new Date(),
  // };




  const workingQuery = await pool.query(
    `INSERT INTO restaurants_working (monday,
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
     )`,
    [
      monday,
      tuesday,
      wednesday,
      thursday,
      friday,
      saturday,
      sunday,
      opening_time,
      closing_time,
      restaurant_id,
    ]
  );
  const addressQuery = await pool.query(
    `INSERT INTO restaurantaddress (street,
    landmark,
    area,
    pincode,
    city,
    state,
    latitude,
    longitude,
    restaurant_id) VALUES(
      ?,?,?,?,?,?,?,?,?
    )`,
    [
      street,
      landmark,
      area,
      pincode,
      city,
      state,
      latitude,
      longitude,
      restaurant_id,
    ]
  );

  res.status(201).json({
    status: "Success",
    message:
      "Restaurant Information was successfully submitted",
  });
});



exports.createRestaurantDocs = asyncChoke(async(req, res, next)=>{
  const { pan_no, GSTIN_no, FSSAI_no, outlet_type, bank_IFSC, bank_account_no } = req.body;
  const {id:restaurant_id} = req.user;
  console.log(req.body);
  try{
    if(!pan_no ||!GSTIN_no ||!FSSAI_no ||!outlet_type || !bank_IFSC || !bank_account_no){
      return next(new AppError(400, "All fields are required"));
    }
    // const [docExists] = await pool.query(`SELECT * FROM restaurant_docs WHERE restaurant_id = ?`, [restaurant_id]);
    // if(docExists.length > 0){
    //   return next(new AppError(409, "Documents already exists"));
    // }
    const query = `INSERT INTO restaurant_docs (pan_no, GSTIN_no, FSSAI_no, outlet_type, restaurant_id, bank_IFSC, bank_account_no) VALUES(?,?,?,?,?,?,?)`;
  const values = [pan_no, GSTIN_no, FSSAI_no, outlet_type, restaurant_id, bank_IFSC, bank_account_no];
  const [result] = await pool.query(query, values);
  if(result.affectedRows === 0){
    return next(new AppError(401, "error while creating your restaurant documents"));
  }
  const [updateApproval] = await pool.query(`UPDATE restaurants SET approved = ? WHERE id = ?`,[false, restaurant_id]);
  if(updateApproval.affectedRows === 0){
    return next(new AppError(401, "error while updating restaurant approval status"));
  }
  res.status(201).json({
    status: "success",
    message: "Restaurant Documents were successfully submitted",
  });
  }
  catch(err){
    return next(new AppError(401, err));
  }
});



exports.getSellerDashboard = asyncChoke(async (req, res, next) => {
  const { id: restaurant_id } = req.user; // Extract restaurant ID from req.user
  const { start_date, end_date } = req.query; // Optional dynamic date range for graphs

  try {
    // Handle dynamic date range or default to all-time data
    const dateCondition = start_date && end_date ? `AND DATE(created_at) BETWEEN ? AND ?` : "";

    // Total income for the restaurant, filtered by date range if provided
    const [totalIncomeResult] = await pool.query(
      `SELECT SUM(res_amount) AS total_income 
       FROM orders 
       WHERE restaurant_id = ?`,
      [restaurant_id]
    );
    const totalIncome = totalIncomeResult[0]?.total_income || 0;

    // Today's income and orders
    const [todayResult] = await pool.query(
      `SELECT COUNT(*) AS orders_today, SUM(res_amount) AS income_today 
       FROM orders 
       WHERE restaurant_id = ? AND DATE(created_at) = CURDATE()`,
      [restaurant_id]
    );
    const ordersToday = todayResult[0]?.orders_today || 0;
    const incomeToday = todayResult[0]?.income_today || 0;

    // Previous day's income and orders
    const [yesterdayResult] = await pool.query(
      `SELECT COUNT(*) AS orders_yesterday, SUM(res_amount) AS income_yesterday 
       FROM orders 
       WHERE restaurant_id = ? AND DATE(created_at) = CURDATE() - INTERVAL 1 DAY`,
      [restaurant_id]
    );
    const ordersYesterday = yesterdayResult[0]?.orders_yesterday || 0;
    const incomeYesterday = yesterdayResult[0]?.income_yesterday || 0;

    // Calculate Average Sales for today
    const [averageSalesResult] = await pool.query(
      `SELECT AVG(res_amount) AS average_sales 
       FROM orders 
       WHERE restaurant_id = ?`,
      [restaurant_id]
    );
    const averageSales = averageSalesResult[0]?.average_sales || 0;

    // Calculate Average Sales for the previous day
    const [averageSalesYesterdayResult] = await pool.query(
      `SELECT AVG(res_amount) AS average_sales_yesterday 
       FROM orders 
       WHERE restaurant_id = ? AND DATE(created_at) = CURDATE() - INTERVAL 1 DAY`,
      [restaurant_id]
    );
    const averageSalesYesterday = averageSalesYesterdayResult[0]?.average_sales_yesterday || 0;

    // Growth rates (Income and Orders)
    const incomeGrowthRate = calculateGrowthRate(incomeToday, incomeYesterday);
    const ordersGrowthRate = calculateGrowthRate(ordersToday, ordersYesterday);
    const averageSalesGrowthRate = calculateGrowthRate(averageSales, averageSalesYesterday);

    // Dynamic revenue and orders graph data, based on the date range if provided
    const [graphData] = await pool.query(
      `SELECT 
          DATE(created_at) AS date, 
          COUNT(*) AS total_orders, 
          SUM(res_amount) AS total_revenue 
       FROM orders 
       WHERE restaurant_id = ? 
       ${dateCondition}
       GROUP BY DATE(created_at) 
       ORDER BY DATE(created_at) ASC`,
      start_date && end_date ? [restaurant_id, start_date, end_date] : [restaurant_id]
    );

    // Response structure
    return res.status(200).json({
      status: "success",
      data: {
        mainData: {
          totalIncome: {
            totalIncome: totalIncome,
            growthRate: `${incomeGrowthRate}%`,
          },
          incomeToday: {
            incomeToday: incomeToday,
            growthRate: `${incomeGrowthRate}%`,
          },
          ordersToday: {
            ordersToday,
            growthRate: `${ordersGrowthRate}%`,
          },
          averageSales: {
            averageSales: averageSales,
            growthRate: `${averageSalesGrowthRate}%`, // Corrected growth rate for average sales
          },
        },
        graphData: graphData.map((item) => ({
          date: item.date,
          totalOrders: item.total_orders,
          totalRevenue: item.total_revenue,
        })),
      },
    });
  } catch (err) {
    console.log(err);
    return next(
      new AppError(500, "Internal Server Error while fetching dashboard data", err)
    );
  }
});







// READ All Approved Restaurants
exports.getAllApprovedRestaurants = asyncChoke(async (req, res, next) => {
  // console.log("i am here");
  const { latitude, longitude } = req.params;
  // console.log(latitude,longitude);
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
    COALESCE(AVG(restaurants_rating.rating), 0) AS avg_rating,
    GROUP_CONCAT(DISTINCT categories.category) AS categories
  FROM 
    restaurants
  INNER JOIN 
    restaurantaddress ON restaurants.id = restaurantaddress.restaurant_id
  LEFT JOIN 
    restaurants_rating ON restaurants.id = restaurants_rating.restaurant_id
  LEFT JOIN 
    menus ON menus.restaurant_id = restaurants.id
  LEFT JOIN 
    categories ON categories.menu_id = menus.id
  WHERE 
    restaurants.approved = true AND ${haversine} <= ?
  GROUP BY 
    restaurants.id, restaurants.restaurant_name, restaurantaddress.latitude, restaurantaddress.longitude
  ORDER BY 
    avg_rating DESC;
`;


  const [rows, fields] = await pool.query(query, [radius]);
console.log(rows);
  if (rows.length > 0) {
    const data = rows.map((row) => {
      const travelTime = row.distance / averageSpeed; // Calculate travel time
      const minTime = travelTime - bufferTime + cookingPackingTime; // Minimum time
      const maxTime = travelTime + bufferTime + cookingPackingTime; // Maximum time
    
      return {
        restaurant_id: row.restaurant_id,
        restaurant_name: row.restaurant_name,
        distance: row.distance,
        avg_rating: parseFloat(row.avg_rating).toFixed(1),
        delivery_time: `${Math.max(0, Math.floor(minTime))} - ${Math.ceil(maxTime)} min`,
        categories: row.categories ? row.categories.split(',') : [], // Convert categories string to array
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
  const radius = 10; // Radius in kilometers
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
    COALESCE(AVG(restaurants_rating.rating), 0) AS avg_rating,
    GROUP_CONCAT(DISTINCT categories.category) AS categories
  FROM 
    restaurants
  INNER JOIN 
    restaurantaddress ON restaurants.id = restaurantaddress.restaurant_id
  LEFT JOIN 
    restaurants_rating ON restaurants.id = restaurants_rating.restaurant_id
  LEFT JOIN 
    menus ON menus.restaurant_id = restaurants.id
  LEFT JOIN 
    categories ON categories.menu_id = menus.id
  WHERE 
    restaurants.approved = true AND ${haversine} <= ?
  GROUP BY 
    restaurants.id, restaurants.restaurant_name, restaurantaddress.latitude, restaurantaddress.longitude
  HAVING 
    COALESCE(AVG(restaurants_rating.rating), 0) > 4.0
  ORDER BY 
    avg_rating DESC;
`;

  const [rows, fields] = await pool.query(query, [radius]);

  if (rows.length > 0) {
    const data = rows.map((row) => {
      const travelTime = row.distance / averageSpeed; // Calculate travel time
      const minTime = travelTime - bufferTime + cookingPackingTime; // Minimum time
      const maxTime = travelTime + bufferTime + cookingPackingTime; // Maximum time
    
      return {
        restaurant_id: row.restaurant_id,
        restaurant_name: row.restaurant_name,
        distance: row.distance,
        avg_rating: parseFloat(row.avg_rating).toFixed(1),
        delivery_time: `${Math.max(0, Math.floor(minTime))} - ${Math.ceil(maxTime)} min`,
        categories: row.categories ? row.categories.split(',') : [], // Convert categories string to array
      };
    });
    
    res.status(200).json({
      status: "Success",
      data,
    });
    
  } else {
    return next(
      new AppError(
        404,
        "Restaurants not found in your location with ratings above 4.0"
      )
    );
  }
});

exports.getAllPopularRestaurants = asyncChoke(async (req, res, next) => {
  const { latitude, longitude } = req.params;
  const radius = 10; // Radius in kilometers
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
    restaurants.order_count,
    GROUP_CONCAT(DISTINCT categories.category) AS categories
  FROM 
    restaurants
  INNER JOIN 
    restaurantaddress ON restaurants.id = restaurantaddress.restaurant_id
  LEFT JOIN 
    restaurants_rating ON restaurants.id = restaurants_rating.restaurant_id
  LEFT JOIN 
    menus ON menus.restaurant_id = restaurants.id
  LEFT JOIN 
    categories ON categories.menu_id = menus.id
  WHERE 
    restaurants.approved = true AND ${haversine} <= ?
  GROUP BY 
    restaurants.id, restaurants.restaurant_name, restaurantaddress.latitude, restaurantaddress.longitude
  ORDER BY 
    restaurants.order_count DESC, avg_rating DESC;
`;


  const [rows, fields] = await pool.query(query, [radius]);

  if (rows.length > 0) {
    const data = rows.map((row) => {
      const travelTime = row.distance / averageSpeed; // Calculate travel time
      const minTime = travelTime - bufferTime + cookingPackingTime; // Minimum time
      const maxTime = travelTime + bufferTime + cookingPackingTime; // Maximum time
    
      return {
        restaurant_id: row.restaurant_id,
        restaurant_name: row.restaurant_name,
        distance: row.distance,
        avg_rating: parseFloat(row.avg_rating).toFixed(1),
        order_count: row.order_count,
        delivery_time: `${Math.max(0, Math.floor(minTime))} - ${Math.ceil(maxTime)} min`,
        categories: row.categories ? row.categories.split(',') : [], // Convert categories string to array
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

exports.getAllRestaurantsBySearch = asyncChoke(async (req, res, next) => {
  const { latitude, longitude, search } = req.query;

  // If search is empty or less than 2 characters, return an empty array
  if (!search || search.trim().length < 2) {
    return res.status(200).json({status: "No results found",
      data: [],});
  }

  const radius = 10; // Radius in kilometers
  const cookingPackingTime = 10; // Fixed 10 minutes for cooking and packing
  const averageSpeed = 0.5; // 30 km/h = 0.5 km/min
  const bufferTime = 5; // Buffer time in minutes for range

  // Haversine formula to calculate distance
  const haversine = `(6371 * acos(cos(radians(${latitude})) * cos(radians(restaurantaddress.latitude)) * cos(radians(restaurantaddress.longitude) - radians(${longitude})) + sin(radians(${latitude})) * sin(radians(restaurantaddress.latitude))))`;

  // Fuzzy search logic with LIKE and SOUNDEX for similar terms
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
      AND (
        restaurants.restaurant_name LIKE ? 
        OR categories.category LIKE ? 
        OR SOUNDEX(restaurants.restaurant_name) = SOUNDEX(?)
        OR SOUNDEX(categories.category) = SOUNDEX(?)
      )
    GROUP BY 
      restaurants.id, restaurants.restaurant_name, restaurantaddress.latitude, restaurantaddress.longitude
  `;

  // Use `%search%` for pattern matching and also pass `search` for SOUNDEX
  const searchPattern = `%${search}%`;

  const [rows, fields] = await pool.query(query, [
    radius,
    searchPattern,
    searchPattern,
    search,
    search,
  ]);

  if (rows.length > 0) {
    const data = rows.map((row) => {
      const travelTime = row.distance / averageSpeed; // Calculate travel time
      const minTime = travelTime - bufferTime + cookingPackingTime; // Minimum time
      const maxTime = travelTime + bufferTime + cookingPackingTime; // Maximum time

      return {
        restaurant_id: row.restaurant_id,
        restaurant_name: row.restaurant_name,
        distance: row.distance,
        avg_rating: parseFloat(row.avg_rating).toFixed(1),
        delivery_time: `${Math.max(0, Math.floor(minTime))} - ${Math.ceil(
          maxTime
        )} min`,
      };
    });

    res.status(200).json({
      status: "Success",
      data,
    });
  } else {
    return res.status(404).json({
      status: "No results found",
      data: [],
    });
  }
});



// exports.getAllRestaurantsByCategories = asyncChoke(async(req,res,next)=>{
//   const {categoryName} = req.body;
//   const query = `SELECT * FROM categories WHERE category = ?`
//   const values = [categoryName]
//   const rows = await pool.query(query,values);
//   if
// })

// READ Restaurant by ID
exports.getRestaurantById = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  const query = "SELECT * FROM restaurants WHERE id = ? AND approved = ?";
  const [rows, fields] = await pool.query(query, [id, true]);

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
  const result = await pool.query(query, values);
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
  const result = await pool.query(query, [id]);
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
  console.log(phone_no)
  phone_no = String(phone_no).trim();

 
  if (!phone_no) {
    return next(new AppError(400, "Fill all fields"));
  }

 
  if(!isValidPhoneNumber(phone_no)){
    return next(new AppError(400, "Please Provide 10 digits mobile number"));
  }
  const [checkQuery] = await pool.query(
    `SELECT * FROM otps WHERE phone_no = ?`,
    [phone_no]
  );

  if (checkQuery.length === 1) {
    // Update OTP in the database for the provided phone number
    const query = `UPDATE otps SET otp = ? WHERE phone_no = ?`;
    const [result, fields] = await pool.query(query, [otp, phone_no]);
    // if(result.affectedRows === 1){
    //   console.log(result.affectedRows, "updated")
    // }
    return res.status(200).json({ message: "OTP sent successfully", otp });
  }
  const [insertQuery] = await pool.query(
    `INSERT INTO otps (phone_no, otp) VALUES (?,?)`,
    [phone_no, otp]
  );
  if(insertQuery.affectedRows === 1){
    console.log(insertQuery.affectedRows, "inserted")
  }
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
  if(!isValidPhoneNumber(phone_no)){
    return next(new AppError(400, "Please Provide 10 digits mobile number"));
  }
  const [checkQuery] = await pool.query(
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
    const [otpResult] = await pool.query(otpQuery, [phone_no, givenOTP]);
    


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
    const [otpResult] = await pool.query(otpQuery, [phone_no, givenOTP]);
    //  console.log(otpResult)
    if (otpResult[0].otp_matched === 1) {
      const [sellerSignUp] = await pool.query(
        `INSERT INTO restaurants (owner_phone_no) VALUE(?)`,
        [phone_no]
      );
      if(sellerSignUp.affectedRows === 1){
        const token = createSendToken(res, req, phone_no);
        return res
          .status(200)
          .json({ message: "Account created successfully", token });
      }
      else{
        return next(new AppError(401, "SignUp Error"));
      }
      
    } else {
      return next(new AppError(401, "Invalid OTP"));
    }
  }
});
