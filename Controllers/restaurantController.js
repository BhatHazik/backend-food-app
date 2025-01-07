const { pool } = require("../Config/database");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
const {
  isValidPhoneNumber,
  calculateGrowthRate,
  createSendToken,
  validateEmail,
} = require("../Utils/utils");
const { getSocketIoServer } = require("../Utils/socketHandler");
const geolib = require("geolib");
const { default: axios } = require("axios");

exports.createRestaurant = asyncChoke(async (req, res, next) => {
  const { id: restaurant_id, approved } = req.user;
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

  const LoginNumber = req.user.owner_phone_no;
  if (LoginNumber !== owner_phone_no) {
    return next(new AppError(404, "Please enter same number given at login"));
  }
  if (!validateEmail(email)) {
    return next(new AppError(400, "Please enter a valid email"));
  }

  const [docExists] = await pool.query(
    `SELECT * FROM restaurant_docs WHERE restaurant_id = ?`,
    [restaurant_id]
  );
  if (docExists.length > 0) {
    return next(new AppError(409, "Documents already exists"));
  }

  if (approved === "pending") {
    return next(
      new AppError(409, "This Restaurant is in a pending approval check")
    );
  }
  if (approved === "approved") {
    return next(new AppError(409, "Restaurant already has been approved"));
  }

  const query = `UPDATE restaurants SET 
    owner_name = ?, 
    owner_email = ?, 
    restaurant_name = ?
  WHERE owner_phone_no = ?
  `;
  const values = [owner_name, owner_email, restaurant_name, owner_phone_no];
  const [result] = await pool.query(query, values);
  if (result.affectedRows === 0) {
    return next(new AppError(401, "error while creating your restaurant"));
  }

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
    message: "Restaurant Information was successfully submitted",
  });
});

exports.createRestaurantDocs = asyncChoke(async (req, res, next) => {
  const {
    pan_no,
    GSTIN_no,
    FSSAI_no,
    outlet_type,
    bank_IFSC,
    bank_account_no,
  } = req.body;
  const { id: restaurant_id, approved } = req.user;
  try {
    
    if (approved === "pending") {
      return next(
        new AppError(
          401,
          "Restaurant is currently in a pending approval check!"
        )
      );
    }
    if (approved === "approved") {
      return next(new AppError(409, "Restaurant already has been approved"));
    }
    if (
      !pan_no ||
      !GSTIN_no ||
      !FSSAI_no ||
      !outlet_type ||
      !bank_IFSC ||
      !bank_account_no
    ) {
      return next(new AppError(400, "All fields are required"));
    }
    const [docExists] = await pool.query(
      `SELECT * FROM restaurant_docs WHERE restaurant_id = ?`,
      [restaurant_id]
    );
    if (docExists.length > 0) {
      return next(new AppError(409, "Documents already exists"));
    }
    const query = `INSERT INTO restaurant_docs (pan_no, GSTIN_no, FSSAI_no, outlet_type, restaurant_id, bank_IFSC, bank_account_no) VALUES(?,?,?,?,?,?,?)`;
    const values = [
      pan_no,
      GSTIN_no,
      FSSAI_no,
      outlet_type,
      restaurant_id,
      bank_IFSC,
      bank_account_no,
    ];
    const [result] = await pool.query(query, values);
    if (result.affectedRows === 0) {
      return next(
        new AppError(401, "error while creating your restaurant documents")
      );
    }
    const [updateApproval] = await pool.query(
      `UPDATE restaurants SET approved = ? WHERE id = ?`,
      ["waiting", restaurant_id]
    );
    if (updateApproval.affectedRows === 0) {
      return next(
        new AppError(401, "error while updating restaurant approval status")
      );
    }
    res.status(201).json({
      status: "success",
      message: "Restaurant Documents were successfully submitted",
    });
  } catch (err) {
    return next(new AppError(401, err));
  }
});

exports.getOrderStats = asyncChoke(async (req, res, next) => {
  const { reports, start_date, end_date } = req.query;
  const { id: restaurant_id } = req.user;

  if (!restaurant_id || !start_date || !end_date) {
    return next(
      new AppError(
        400,
        "Missing required parameters: restaurant_id, start_date, or end_date."
      )
    );
  }

  try {
    let query;
    let allDataQuery;
    let queryParams = [restaurant_id, start_date, end_date];
    let allDataQueryParams = [restaurant_id];
    if (reports === "orders") {
      allDataQuery = `SELECT
    COUNT(*) AS total_orders, -- Total number of orders
    SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders, -- Count of cancelled orders
    SUM(CASE WHEN order_status IN ('delivered', 'completed') THEN 1 ELSE 0 END) AS completed_orders -- Count of delivered or completed orders
FROM 
    orders
WHERE 
    restaurant_id = ?;
`;
      query = `
        SELECT 
          CONVERT_TZ(created_at, '+00:00', '+05:30') AS order_date,
          COUNT(*) AS order_count
        FROM 
          orders
        WHERE 
          restaurant_id = ?
          AND created_at BETWEEN ? AND ?
        GROUP BY 
          order_date
        ORDER BY 
          order_date DESC;
      `;
    } else if (reports === "revenue") {
      allDataQuery = `
        SELECT 
    SUM(CASE WHEN b.payment_type = 'cod' THEN 1 ELSE 0 END) AS COD_payment,
    SUM(CASE WHEN b.payment_type != 'cod' THEN 1 ELSE 0 END) AS online_payment,
    ROUND(
        (SUM(CASE WHEN b.payment_type = 'cod' THEN 1 ELSE 0 END) / COUNT(o.bill_id)) * 100, 2
    ) AS COD_payment_percentage,
    ROUND(
        (SUM(CASE WHEN b.payment_type != 'cod' THEN 1 ELSE 0 END) / COUNT(o.bill_id)) * 100, 2
    ) AS online_payment_percentage
FROM 
    orders o
LEFT JOIN 
    bills b 
ON 
    o.bill_id = b.id
WHERE 
    o.restaurant_id = ?;
`;
      query = `
        SELECT 
          CONVERT_TZ(created_at, '+00:00', '+05:30') AS order_date,
          SUM(res_amount) AS total_revenue
        FROM 
          orders
        WHERE 
          restaurant_id = ?
          AND created_at BETWEEN ? AND ?
          AND order_status NOT IN ('pending', 'cancelled')
        GROUP BY 
          order_date
        ORDER BY 
          order_date DESC;
      `;
    } else {
      return next(
        new AppError(
          400,
          'Invalid report type. Please choose between "orders" or "revenue".'
        )
      );
    }

    const [graphData] = await pool.query(query, queryParams);
    const [allData] = await pool.query(allDataQuery, allDataQueryParams);

    if (graphData.length === 0) {
      return next(
        new AppError(404, "No data found for the specified parameters.")
      );
    }

    return res.status(200).json({
      status: "success",
      data: { graphData, allData },
    });
  } catch (err) {
    console.error(err);
    return next(new AppError(500, "Internal Server Error", err));
  }
});

exports.getSellerDashboard = asyncChoke(async (req, res, next) => {
  const { id: restaurant_id } = req.user;
  const { start_date, end_date } = req.query;

  try {
    const dateCondition =
      start_date && end_date ? `AND DATE(created_at) BETWEEN ? AND ?` : "";

    const [dashboardData] = await pool.query(
      `SELECT 
          COALESCE(SUM(CASE WHEN order_status IN ('arrived', 'on the way', 'delivered') THEN res_amount ELSE 0 END), 0) AS total_income,
          COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND order_status IN ('arrived', 'on the way', 'delivered') THEN res_amount ELSE 0 END), 0) AS income_today,
          COALESCE(COUNT(CASE WHEN DATE(created_at) = CURDATE() AND order_status IN ('arrived', 'on the way', 'delivered') THEN 1 ELSE NULL END), 0) AS orders_today,
          COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() - INTERVAL 1 DAY AND order_status IN ('arrived', 'on the way', 'delivered') THEN res_amount ELSE 0 END), 0) AS income_yesterday,
          COALESCE(COUNT(CASE WHEN DATE(created_at) = CURDATE() - INTERVAL 1 DAY AND order_status IN ('arrived', 'on the way', 'delivered') THEN 1 ELSE NULL END), 0) AS orders_yesterday,
          COALESCE(AVG(res_amount), 0) AS average_sales,
          COALESCE(AVG(CASE WHEN DATE(created_at) = CURDATE() - INTERVAL 1 DAY THEN res_amount ELSE NULL END), 0) AS average_sales_yesterday
       FROM orders
       WHERE restaurant_id = ?`,
      [restaurant_id]
    );

    const {
      total_income = 0,
      income_today = 0,
      orders_today = 0,
      income_yesterday = 0,
      orders_yesterday = 0,
      average_sales = 0,
      average_sales_yesterday = 0,
    } = dashboardData[0] || {};

    const totalIncome = parseFloat(total_income) || 0;
    const incomeToday = parseFloat(income_today) || 0;
    const ordersToday = parseInt(orders_today, 10) || 0;
    const incomeYesterday = parseFloat(income_yesterday) || 0;
    const ordersYesterday = parseInt(orders_yesterday, 10) || 0;
    const averageSales = parseFloat(average_sales) || 0;
    const averageSalesYesterday = parseFloat(average_sales_yesterday) || 0;

    const incomeGrowthRate = calculateGrowthRate(incomeToday, incomeYesterday);
    const ordersGrowthRate = calculateGrowthRate(ordersToday, ordersYesterday);
    const averageSalesGrowthRate = calculateGrowthRate(
      averageSales,
      averageSalesYesterday
    );

    let query = `
  SELECT 
        CONVERT_TZ(created_at, '+00:00', '+05:30') AS order_date,
        COUNT(*) AS order_count,
        SUM(res_amount) AS total_amount
      FROM 
        orders
      WHERE 
        restaurant_id = ?
        AND order_status NOT IN(?,?,?) AND created_at BETWEEN ? AND ?
      GROUP BY 
        order_date
      ORDER BY 
        order_date DESC;
`;

    let queryParams = [
      restaurant_id,
      "pending",
      "confirmed",
      "cancelled",
      start_date,
      end_date,
    ];

    const [graphData] = await pool.query(query, queryParams);

    return res.status(200).json({
      status: "success",
      data: {
        mainData: {
          totalIncome: {
            totalIncome: totalIncome.toFixed(2),
            growthRate: `${incomeGrowthRate}%`,
          },
          incomeToday: {
            incomeToday: incomeToday.toFixed(2),
            growthRate: `${incomeGrowthRate}%`,
          },
          ordersToday: {
            ordersToday,
            growthRate: `${ordersGrowthRate}%`,
          },
          averageSales: {
            averageSales: averageSales.toFixed(2),
            growthRate: `${averageSalesGrowthRate}%`,
          },
        },
        graphData: graphData.map((item) => ({
          date: item.order_date,
          totalOrders: item.order_count,
          totalRevenue: parseFloat(item.total_amount).toFixed(2),
        })),
      },
    });
  } catch (err) {
    console.error(err);
    return next(
      new AppError(
        500,
        "Internal Server Error while fetching dashboard data",
        err
      )
    );
  }
});

exports.getMostOrderedItems = asyncChoke(async (req, res, next) => {
  const { id: restaurant_id } = req.user;
  try {
    const [topItems] = await pool.query(
      `SELECT i.name AS item_name, COUNT(oi.item_id) AS order_count
       FROM order_items oi
       JOIN items i ON oi.item_id = i.id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.restaurant_id = ?
       GROUP BY oi.item_id
       ORDER BY order_count DESC
       LIMIT 6`,
      [restaurant_id]
    );

    return res.status(200).json({
      status: "success",
      data: topItems,
    });
  } catch (err) {
    console.log(err);
    return next(
      new AppError(
        500,
        "Internal Server Error while fetching top ordered items",
        err
      )
    );
  }
});

exports.getAllApprovedRestaurants = asyncChoke(async (req, res, next) => {
  const { latitude, longitude } = req.params; // User's location

  // Fetch the app settings from the app_settings table
  const settingsQuery = `
    SELECT circular_radius, route_distance, buffer_time
    FROM app_settings
    WHERE id = 1; -- Assuming there is only one entry in the app_settings table
  `;

  const [settings] = await pool.query(settingsQuery);

  if (settings.length === 0) {
    return next(new AppError(404, "App settings not found"));
  }

  const { circular_radius, route_distance, buffer_time } = settings[0];

  // Updated Query with Haversine formula and cooking_time from the restaurants table
  const query = `
    SELECT 
      restaurants.id AS restaurant_id,
      restaurants.restaurant_name,
      restaurantaddress.latitude AS restaurant_lat,
      restaurantaddress.longitude AS restaurant_lng,
      COALESCE(AVG(user_rated_restaurants.rating), 0) AS avg_rating, -- Fetch avg rating from user_rated_restaurants
      GROUP_CONCAT(DISTINCT categories.category) AS categories,
      restaurants.cooking_time AS cooking_time, -- Fetch cooking_time from the restaurants table
      (
        6371 * acos(
          cos(radians(?)) * cos(radians(restaurantaddress.latitude)) * 
          cos(radians(restaurantaddress.longitude) - radians(?)) +
          sin(radians(?)) * sin(radians(restaurantaddress.latitude))
        )
      ) AS distance -- Haversine formula to calculate distance in km
    FROM 
      restaurants
    INNER JOIN 
      restaurantaddress ON restaurants.id = restaurantaddress.restaurant_id
    LEFT JOIN 
      user_rated_restaurants ON user_rated_restaurants.restaurant_id = restaurants.id
    LEFT JOIN 
      menus ON menus.restaurant_id = restaurants.id
    LEFT JOIN 
      categories ON categories.menu_id = menus.id
    WHERE 
      restaurants.approved = approved
    GROUP BY 
      restaurants.id, restaurants.restaurant_name, restaurantaddress.latitude, restaurantaddress.longitude, restaurants.cooking_time
    HAVING 
      distance <= ? -- Only fetch restaurants within the circular_radius using Haversine
    ORDER BY 
      avg_rating DESC;
  `;

  // Execute the query with user's location and circular radius for Haversine formula
  const [rows] = await pool.query(query, [latitude, longitude, latitude, circular_radius]);

  if (rows.length === 0) {
    return next(new AppError(404, "Restaurants not found in your location"));
  }

  // Function to calculate distance and time using OpenRouteService API
  const calculateDistanceAndTime = async (userLat, userLon, restLat, restLon) => {
    const API_KEY = process.env.OPEN_ROUTE_SERVICE_API_KEY;
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${API_KEY}&start=${userLon},${userLat}&end=${restLon},${restLat}`;
    try {
      const response = await axios.get(url);
      const segment = response.data.features[0].properties.segments[0];
      const distanceInKilometers = segment.distance / 1000; // Convert meters to kilometers
      const timeInMinutes = segment.duration / 60; // Convert seconds to minutes

      return {
        distance: distanceInKilometers.toFixed(2),
        time: Math.ceil(timeInMinutes),
      };
    } catch (err) {
      console.error("Error fetching distance and time:", err.message);
      return null;
    }
  };

  // Array to store restaurant data with distance and time
  const data = [];

  // Loop through each restaurant and calculate distance and time
  for (const restaurant of rows) {
    const result = await calculateDistanceAndTime(
      latitude,
      longitude,
      restaurant.restaurant_lat,
      restaurant.restaurant_lng
    );

    if (result && result.distance <= route_distance) {
      const cookingTime = restaurant.cooking_time || 0; // Default cooking time to 0 if null

      // Calculate total delivery time: cooking time + delivery time + buffer time from app settings
      const totalDeliveryTime = 
        Number(cookingTime) + Number(result.time) + Number(buffer_time);

      data.push({
        restaurant_id: restaurant.restaurant_id,
        restaurant_name: restaurant.restaurant_name,
        distance: result.distance,
        avg_rating: parseFloat(restaurant.avg_rating).toFixed(1),
        delivery_time: `${totalDeliveryTime} - ${totalDeliveryTime + buffer_time} mins`, // Total time to reach the user
        categories: restaurant.categories ? restaurant.categories.split(',') : [],
      });
    }
  }

  if (data.length === 0) {
    return next(new AppError(404, "No restaurants found within the configured route distance"));
  }

  // Send the response
  res.status(200).json({
    status: "Success",
    data,
  });
});




exports.getAllTopRatedRestaurants = asyncChoke(async (req, res, next) => {
  const { latitude, longitude } = req.params;

  // Fetch app settings
  const settingsQuery = `
    SELECT circular_radius, route_distance, buffer_time
    FROM app_settings
    WHERE id = 1; -- Assuming a single entry in the app_settings table
  `;
  const [settings] = await pool.query(settingsQuery);

  if (settings.length === 0) {
    return next(new AppError(404, "App settings not found"));
  }

  const { circular_radius, route_distance, buffer_time } = settings[0];

  // Query to fetch restaurants within the radius using the Haversine formula
  const query = `
    SELECT 
      restaurants.id AS restaurant_id,
      restaurants.restaurant_name,
      restaurantaddress.latitude AS restaurant_lat,
      restaurantaddress.longitude AS restaurant_lng,
      COALESCE(AVG(user_rated_restaurants.rating), 0) AS avg_rating,
      GROUP_CONCAT(DISTINCT categories.category) AS categories,
      restaurants.cooking_time AS cooking_time,
      (6371 * acos(
        cos(radians(?)) * 
        cos(radians(restaurantaddress.latitude)) * 
        cos(radians(restaurantaddress.longitude) - radians(?)) + 
        sin(radians(?)) * 
        sin(radians(restaurantaddress.latitude))
      )) AS distance
    FROM 
      restaurants
    INNER JOIN 
      restaurantaddress ON restaurants.id = restaurantaddress.restaurant_id
    LEFT JOIN 
      user_rated_restaurants ON user_rated_restaurants.restaurant_id = restaurants.id
    LEFT JOIN 
      menus ON menus.restaurant_id = restaurants.id
    LEFT JOIN 
      categories ON categories.menu_id = menus.id
    WHERE 
      restaurants.approved = approved
    GROUP BY 
      restaurants.id, restaurants.restaurant_name, restaurantaddress.latitude, restaurantaddress.longitude, restaurants.cooking_time
    HAVING 
      distance <= ? -- Filter based on circular_radius
    ORDER BY 
      avg_rating DESC;
  `;

  // Execute the query with user's location and circular_radius
  const [rows] = await pool.query(query, [latitude, longitude, latitude, circular_radius]);

  if (rows.length === 0) {
    return next(new AppError(404, "No top-rated restaurants found within the configured circular radius"));
  }

  // OpenRouteService API call to calculate precise distance and duration
  const calculateDistanceAndTime = async (userLat, userLon, restLat, restLon) => {
    const API_KEY = process.env.OPEN_ROUTE_SERVICE_API_KEY;
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${API_KEY}&start=${userLon},${userLat}&end=${restLon},${restLat}`;
    try {
      const response = await axios.get(url);
      const segment = response.data.features[0].properties.segments[0];
      const distanceInKilometers = segment.distance / 1000; // Convert meters to kilometers
      const timeInMinutes = segment.duration / 60; // Convert seconds to minutes

      return {
        distance: distanceInKilometers.toFixed(2),
        time: Math.ceil(timeInMinutes),
      };
    } catch (err) {
      console.error("Error fetching distance and time:", err.message);
      return null;
    }
  };

  // Prepare response data
  const data = [];

  for (const restaurant of rows) {
    const result = await calculateDistanceAndTime(
      latitude,
      longitude,
      restaurant.restaurant_lat,
      restaurant.restaurant_lng
    );

    // Check if the OpenRouteService distance is within the route_distance
    if (result && result.distance <= route_distance) {
      const cookingTime = restaurant.cooking_time || 0; // Default cooking time to 0 if null

      // Calculate total delivery time: cooking time + travel time + buffer time
      const totalDeliveryTime = 
        Number(cookingTime) + Number(result.time) + Number(buffer_time);

      data.push({
        restaurant_id: restaurant.restaurant_id,
        restaurant_name: restaurant.restaurant_name,
        distance: result.distance, // Distance from OpenRouteService
        avg_rating: parseFloat(restaurant.avg_rating).toFixed(1),
        delivery_time: `${totalDeliveryTime} - ${totalDeliveryTime + buffer_time} mins`,
        categories: restaurant.categories ? restaurant.categories.split(",") : [],
      });
    }
  }

  if (data.length === 0) {
    return next(new AppError(404, "No top-rated restaurants found within the configured route distance"));
  }

  // Send success response
  res.status(200).json({
    status: "Success",
    data,
  });
});



exports.getAllPopularRestaurants = asyncChoke(async (req, res, next) => {
  const { latitude, longitude } = req.params;

  // Fetch app settings
  const settingsQuery = `
    SELECT circular_radius, route_distance, buffer_time
    FROM app_settings
    WHERE id = 1; -- Assuming a single entry in the app_settings table
  `;
  const [settings] = await pool.query(settingsQuery);

  if (settings.length === 0) {
    return next(new AppError(404, "App settings not found"));
  }

  const { circular_radius, route_distance, buffer_time } = settings[0];

  // Query to pre-filter restaurants within the radius using the Haversine formula
  const query = `
    SELECT 
      restaurants.id AS restaurant_id,
      restaurants.restaurant_name,
      restaurantaddress.latitude AS restaurant_lat,
      restaurantaddress.longitude AS restaurant_lng,
      COALESCE(AVG(user_rated_restaurants.rating), 0) AS avg_rating,
      GROUP_CONCAT(DISTINCT categories.category) AS categories,
      restaurants.cooking_time AS cooking_time,
      restaurants.order_count,
      (6371 * acos(
        cos(radians(?)) * 
        cos(radians(restaurantaddress.latitude)) * 
        cos(radians(restaurantaddress.longitude) - radians(?)) + 
        sin(radians(?)) * 
        sin(radians(restaurantaddress.latitude))
      )) AS distance
    FROM 
      restaurants
    INNER JOIN 
      restaurantaddress ON restaurants.id = restaurantaddress.restaurant_id
    LEFT JOIN 
      user_rated_restaurants ON user_rated_restaurants.restaurant_id = restaurants.id
    LEFT JOIN 
      menus ON menus.restaurant_id = restaurants.id
    LEFT JOIN 
      categories ON categories.menu_id = menus.id
    WHERE 
      restaurants.approved = approved
    GROUP BY 
      restaurants.id, restaurants.restaurant_name, restaurantaddress.latitude, restaurantaddress.longitude, restaurants.cooking_time
    HAVING 
      distance <= ? -- Filter restaurants within the circular_radius
    ORDER BY 
      restaurants.order_count DESC; -- Sort by order_count in descending order
  `;

  // Execute the query with parameterized values
  const [rows] = await pool.query(query, [latitude, longitude, latitude, circular_radius]);

  if (rows.length === 0) {
    return next(
      new AppError(404, "No popular restaurants found within the configured circular radius")
    );
  }

  // OpenRouteService API call to calculate precise distance and time
  const calculateDistanceAndTime = async (userLat, userLon, restLat, restLon) => {
    const API_KEY = process.env.OPEN_ROUTE_SERVICE_API_KEY;
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${API_KEY}&start=${userLon},${userLat}&end=${restLon},${restLat}`;
    try {
      const response = await axios.get(url);
      const segment = response.data.features[0].properties.segments[0];
      const distanceInKilometers = segment.distance / 1000; // Convert meters to kilometers
      const timeInMinutes = segment.duration / 60; // Convert seconds to minutes

      return {
        distance: distanceInKilometers.toFixed(2),
        time: Math.ceil(timeInMinutes),
      };
    } catch (err) {
      console.error("Error fetching distance and time:", err.message);
      return null;
    }
  };

  // Prepare response data
  const data = [];

  for (const restaurant of rows) {
    const result = await calculateDistanceAndTime(
      latitude,
      longitude,
      restaurant.restaurant_lat,
      restaurant.restaurant_lng
    );

    // Check if the OpenRouteService distance is within the route_distance
    if (result && result.distance <= route_distance) {
      const cookingTime = restaurant.cooking_time || 0; // Default cooking time to 0 if null

      // Calculate total delivery time: cooking time + travel time + buffer time
      const totalDeliveryTime = 
        Number(cookingTime) + Number(result.time) + Number(buffer_time);

      data.push({
        restaurant_id: restaurant.restaurant_id,
        restaurant_name: restaurant.restaurant_name,
        distance: result.distance, // Distance from OpenRouteService
        avg_rating: parseFloat(restaurant.avg_rating).toFixed(1),
        order_count: restaurant.order_count,
        delivery_time: `${totalDeliveryTime} - ${totalDeliveryTime + buffer_time} mins`,
        categories: restaurant.categories ? restaurant.categories.split(",") : [],
      });
    }
  }

  if (data.length === 0) {
    return next(new AppError(404, "No popular restaurants found within the configured route distance"));
  }

  // Send success response
  res.status(200).json({
    status: "Success",
    data,
  });
});



exports.getAllRestaurantsBySearch = asyncChoke(async (req, res, next) => {
  const { latitude, longitude, search } = req.query;

  if (!search || search.trim().length < 2) {
    return res.status(200).json({
      status: "Success",
      data: [],
    });
  }

  // Fetch the app settings from the app_settings table
  const settingsQuery = `
    SELECT circular_radius, route_distance, buffer_time
    FROM app_settings
    WHERE id = 1;
  `;

  const [settings] = await pool.query(settingsQuery);

  if (settings.length === 0) {
    return next(new AppError(404, "App settings not found"));
  }

  const { circular_radius, route_distance, buffer_time } = settings[0];

  // Haversine formula to pre-filter restaurants within the radius
  const haversine = `(6371 * acos(
    cos(radians(${latitude})) * 
    cos(radians(restaurantaddress.latitude)) * 
    cos(radians(restaurantaddress.longitude) - radians(${longitude})) + 
    sin(radians(${latitude})) * 
    sin(radians(restaurantaddress.latitude))
  ))`;

  const query = `
    SELECT 
      restaurants.id AS restaurant_id, 
      restaurants.restaurant_name, 
      restaurantaddress.latitude AS restaurant_lat,
      restaurantaddress.longitude AS restaurant_lng,
      ${haversine} AS distance, 
      COALESCE(AVG(restaurants_rating.rating), 0) AS avg_rating,
      restaurants.cooking_time AS cooking_time
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
      restaurants.approved = approved 
      AND ${haversine} <= ? -- Filter by radius
      AND (
        restaurants.restaurant_name LIKE ? 
        OR categories.category LIKE ? 
        OR SOUNDEX(restaurants.restaurant_name) = SOUNDEX(?) 
        OR SOUNDEX(categories.category) = SOUNDEX(?)
      )
    GROUP BY 
      restaurants.id, restaurants.restaurant_name, restaurantaddress.latitude, restaurantaddress.longitude, restaurants.cooking_time
  `;

  const searchPattern = `%${search}%`;

  // Execute the query
  const [rows] = await pool.query(query, [
    circular_radius,
    searchPattern,
    searchPattern,
    search,
    search,
  ]);

  if (rows.length === 0) {
    return res.status(200).json({
      status: "Success",
      data: [],
    }); // Use return to stop further execution
  }

  // Function to calculate distance and time using OpenRouteService API
  const calculateDistanceAndTime = async (userLat, userLon, restLat, restLon) => {
    const API_KEY = process.env.OPEN_ROUTE_SERVICE_API_KEY;
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${API_KEY}&start=${userLon},${userLat}&end=${restLon},${restLat}`;
    try {
      const response = await axios.get(url);
      const segment = response.data.features[0].properties.segments[0];
      const distanceInKilometers = segment.distance / 1000; // Convert meters to kilometers
      const timeInMinutes = segment.duration / 60; // Convert seconds to minutes

      return {
        distance: distanceInKilometers.toFixed(2),
        time: Math.ceil(timeInMinutes),
      };
    } catch (err) {
      console.error("Error fetching distance and time:", err.message);
      return null;
    }
  };

  // Array to store restaurant data with distance and time
  const data = [];

  // Loop through each restaurant and calculate distance and time
  for (const row of rows) {
    const result = await calculateDistanceAndTime(
      latitude,
      longitude,
      row.restaurant_lat,
      row.restaurant_lng
    );

    if (result && result.distance <= route_distance) {
      const cookingTime = row.cooking_time || 0; // Default cooking time to 0 if null

      // Calculate total delivery time: cooking time + delivery time + buffer time from app settings
      const totalDeliveryTime =
        Number(cookingTime) + Number(result.time) + Number(buffer_time);

      data.push({
        restaurant_id: row.restaurant_id,
        restaurant_name: row.restaurant_name,
        distance: result.distance,
        avg_rating: parseFloat(row.avg_rating).toFixed(1),
        delivery_time: `${totalDeliveryTime} - ${totalDeliveryTime + buffer_time} mins`,
      });
    }
  }

  if (data.length === 0) {
    return next(new AppError(404, "No restaurants found within the configured route distance"));
  }

  // Send the response
  res.status(200).json({
    status: "Success",
    data,
  });
});





exports.getRestaurantById = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  const query = "SELECT * FROM restaurants WHERE id = ? AND approved = ?";
  const [rows, fields] = await pool.query(query, [id, "approved"]);

  if (!rows || rows.length === 0) {
    return next(new AppError(404, `Restaurant with id '${id}' not found`));
  }

  res.status(200).json({
    status: "Success",
    data: rows[0],
  });
});

exports.updateRestaurant = asyncChoke(async (req, res, next) => {
  const { id, approved } = req.user;
  const { 
    owner_name, 
    owner_phone_no, 
    owner_email, 
    street, 
    landmark, 
    area, 
    pincode, 
    city, 
    state, 
    latitude, 
    longitude 
  } = req.body;

  // Ensure the restaurant is approved
  if (!approved || approved === "approved") {
    return next(
      new AppError(403, "You are not authorized to update this restaurant")
    );
  }

  // Check if required fields are provided
  if (!owner_name || !owner_phone_no || !owner_email ||
    !street || !landmark || !area || !pincode || !city || !state || !latitude || !longitude) {
    return next(new AppError(400, "All fields are required"));
  }

  // Validate email
  if (!validateEmail(owner_email)) {
    return next(new AppError(400, "Please enter a valid email"));
  }

  // Update restaurant information
  const query =
    `UPDATE restaurants SET 
      owner_name = ?, 
      owner_phone_no = ?, 
      owner_email = ?
    WHERE id = ? AND approved = ?`;
  const values = [
    owner_name, 
    owner_phone_no, 
    owner_email, 
    id, 
    "approved"
  ];
  
  const result = await pool.query(query, values);
  if (result.affectedRows === 0) {
    return next(new AppError(404, `Restaurant with id '${id}' not found`));
  }

  // Update the address details
  const addressQuery =
    `UPDATE restaurantaddress SET
      street = ?, 
      landmark = ?, 
      area = ?, 
      pincode = ?, 
      city = ?, 
      state = ?, 
      latitude = ?, 
      longitude = ?
    WHERE restaurant_id = ?`;

  const addressValues = [
    street,
    landmark,
    area,
    pincode,
    city,
    state,
    latitude,
    longitude,
    id
  ];

  const addressResult = await pool.query(addressQuery, addressValues);
  if (addressResult.affectedRows === 0) {
    return next(new AppError(404, `Address for restaurant with id '${id}' not found`));
  }

  // Success response
  res.status(200).json({
    status: "Success",
    message: `Restaurant with id '${id}' and address updated successfully`,
  });
});

exports.getRestaurantById = asyncChoke(async (req, res, next) => {
  const { id } = req.user;


  const restaurantQuery = 
    `SELECT owner_name, owner_phone_no, owner_email, restaurant_name 
    FROM restaurants WHERE id = ?`;
  const [restaurant] = await pool.query(restaurantQuery, [id]);

  if (restaurant.length === 0) {
    return next(new AppError(404, `Restaurant with id '${id}' not found`));
  }

  // Query to get the address information
  const addressQuery =
    `SELECT street, landmark, area, pincode, city, state, latitude, longitude
    FROM restaurantaddress WHERE restaurant_id = ?`;
  const [address] = await pool.query(addressQuery, [id]);

  if (address.length === 0) {
    return next(new AppError(404, `Address for restaurant with id '${id}' not found`));
  }

  // Combine both restaurant and address data
  const result = {
    restaurant: restaurant[0],
    address: address[0],
  };

  // Send the response with the combined data
  res.status(200).json({
    status: "Success",
    data: result,
  });
});



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

exports.orderAcception = asyncChoke(async (req, res, next) => {
  const { order_id, type } = req.query;
  const { id: restaurant_id } = req.user;
  let order_status;

  try {
    if (type !== "confirm" && type !== "cancel") {
      return next(new AppError(400, "Invalid type"));
    }

    const [order] = await pool.query(
      `SELECT o.id AS order_id, o.order_status, o.restaurant_id, o.user_id, o.del_amount, ra.latitude, ra.longitude
       FROM orders o
       JOIN restaurantaddress ra ON o.restaurant_id = ra.restaurant_id
       WHERE o.id = ? AND o.restaurant_id = ?`,
      [order_id, restaurant_id]
    );

    if (!order || order.length === 0) {
      return next(new AppError(404, `Order with id '${order_id}' not found`));
    }

    if (order[0].order_status === "confirmed") {
      return next(new AppError(400, "Order already accepted"));
    }

    if (order[0].status === "cancelled") {
      return next(new AppError(400, "Order already canceled"));
    }

    if (order[0].restaurant_id !== restaurant_id) {
      return next(
        new AppError(403, "You are not authorized to accept this order")
      );
    }

    if (type === "cancel") {
      order_status = "cancelled";
    }

    if (type === "confirm") {
      order_status = "confirmed";
    }

    const query = "UPDATE orders SET order_status = ? WHERE id = ?";
    await pool.query(query, [order_status, order_id]);

    const userId = order[0].user_id;

    const io = getSocketIoServer();

    if (io.connectedUsers[userId]) {
      io.to(io.connectedUsers[userId]).emit("orderStatus", {
        status: order_status,
        message: `Your order ${order_id} has been ${order_status} by the restaurant!`,
      });
    }
    if (order_status === "confirmed") {
      const restaurantLocation = {
        lat: order[0].latitude,
        lng: order[0].longitude,
      };

      for (const deliveryBoyId in io.connectedDeliveryBoys) {
        const deliveryBoy = io.connectedDeliveryBoys[deliveryBoyId];
        
        if (deliveryBoy.status === "online") {
          const deliveryBoyLocation = deliveryBoy.location;
          console.log(deliveryBoyLocation, deliveryBoyId);
          const distance = geolib.getDistance(
            restaurantLocation,
            deliveryBoyLocation
          );

          if (distance <= 10000) {
            io.to(deliveryBoy.socketId).emit("newOrderNotification", {
              message: `New order available from Restaurant ${restaurant_id}.`,
              orderDetails: order[0],
            });
          }
        }
      }
    }
    res.status(200).json({
      status: "Success",
      message: `Order with id '${order_id}' accepted successfully`,
    });
  } catch (err) {
    console.error(err);
    next(new AppError(500, "Server Error"));
  }
});

exports.sellerOTPsender = asyncChoke(async (req, res, next) => {
  const generateOTP = () => {
    return Math.floor(1000 + Math.random() * 9000);
  };

  const otp = generateOTP();
  let { phone_no } = req.body;
  phone_no = String(phone_no).trim();

  if (!phone_no) {
    return next(new AppError(400, "Fill all fields"));
  }

  if (!isValidPhoneNumber(phone_no)) {
    return next(new AppError(400, "Please Provide 10 digits mobile number"));
  }
  const [checkQuery] = await pool.query(
    `SELECT * FROM otps WHERE phone_no = ?`,
    [phone_no]
  );

  if (checkQuery.length === 1) {
    const query = `UPDATE otps SET otp = ? WHERE phone_no = ?`;
    const [result, fields] = await pool.query(query, [otp, phone_no]);
    return res.status(200).json({ message: "OTP sent successfully", otp });
  }
  const [insertQuery] = await pool.query(
    `INSERT INTO otps (phone_no, otp) VALUES (?,?)`,
    [phone_no, otp]
  );
  if (insertQuery.affectedRows === 1) {
  }
  return res
    .status(200)
    .json({ message: "OTP sent successfully", otp, phone_no });
});

exports.sellerLogin = asyncChoke(async (req, res, next) => {
  const { givenOTP } = req.body;
  const phone_no = req.params.phNO;
  const role = "seller";
  if (!givenOTP) {
    return next(new AppError(400, "OTP cannot be empty"));
  }
  if (!phone_no) {
    return next(new AppError(400, "Phone number cannot be empty"));
  }
  if (!isValidPhoneNumber(phone_no)) {
    return next(new AppError(400, "Please Provide 10 digits mobile number"));
  }
  const [checkQuery] = await pool.query(
    `SELECT * FROM restaurants WHERE owner_phone_no = ?`,
    [phone_no]
  );
  if (checkQuery.length > 0) {
    const otpQuery = `
      SELECT COUNT(*) AS otp_matched
      FROM otps
      WHERE phone_no = ?
        AND otp = ?
  `;
    const [otpResult] = await pool.query(otpQuery, [phone_no, givenOTP]);

    if (otpResult[0].otp_matched === 1) {
      const token = createSendToken(res, req, phone_no, role);
      const approved = checkQuery[0].approved;
      return res
        .status(200)
        .json({ message: "Login success", token, approved: approved });
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
    if (otpResult[0].otp_matched === 1) {
      const [sellerSignUp] = await pool.query(
        `INSERT INTO restaurants (owner_phone_no) VALUE(?)`,
        [phone_no]
      );
      if (sellerSignUp.affectedRows === 1) {
        const token = createSendToken(res, req, phone_no);
        return res
          .status(200)
          .json({ message: "Account created successfully", data: checkQuery[0], token });
      } else {
        return next(new AppError(401, "SignUp Error"));
      }
    } else {
      return next(new AppError(401, "Invalid OTP"));
    }
  }
});
