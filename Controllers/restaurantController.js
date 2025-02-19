const { pool } = require("../Config/database");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
const {
  isValidPhoneNumber,
  calculateGrowthRate,
  createSendToken,
  validateEmail,
  getRouteDistance,
} = require("../Utils/utils");
const { getSocketIoServer } = require("../Utils/socketHandler");
const geolib = require("geolib");
const { default: axios } = require("axios");
const { uploadDocuments, uploadFile } = require("../Config/aws");

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
  if (!validateEmail(owner_email)) {
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
      ["pending", restaurant_id]
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
  const { reports, date: selectedDateParam, period = 'day' } = req.query;
  const { id: restaurant_id } = req.user;

  if (!restaurant_id || !selectedDateParam || !period) {
    return next(
      new AppError(
        400,
        "Missing required parameters: restaurant_id, date, or period."
      )
    );
  }

  if (!['day', 'week', 'month', 'year'].includes(period)) {
    return next(new AppError(400, "Invalid period. Use: day, week, month, year."));
  }

  try {
    const selectedDate = new Date(selectedDateParam);

    // Date range calculation in IST converted to UTC
    const getUTCDateRange = (period, date) => {
      const tzOffsetMinutes = 330; // IST offset: +05:30
      const tzOffsetMs = tzOffsetMinutes * 60 * 1000;
      let start, end;

      const localDate = new Date(date.getTime() + tzOffsetMs);

      switch (period) {
        case 'day':
          start = new Date(localDate);
          start.setDate(start.getDate() - 6);
          start.setHours(0, 0, 0, 0);
          end = new Date(localDate);
          end.setHours(23, 59, 59, 999);
          break;
        case 'week':
          start = new Date(localDate.getFullYear(), localDate.getMonth(), 1);
          end = new Date(localDate.getFullYear(), localDate.getMonth() + 1, 0);
          end.setHours(23, 59, 59, 999);
          break;
        case 'month':
          start = new Date(localDate.getFullYear(), 0, 1);
          end = new Date(localDate.getFullYear(), 11, 31);
          end.setHours(23, 59, 59, 999);
          break;
        case 'year':
          start = new Date(localDate.getFullYear() - 4, 0, 1);
          end = new Date(localDate.getFullYear(), 11, 31);
          end.setHours(23, 59, 59, 999);
          break;
      }

      return {
        start: new Date(start.getTime() - tzOffsetMs),
        end: new Date(end.getTime() - tzOffsetMs)
      };
    };

    const { start, end } = getUTCDateRange(period, selectedDate);
    const formatDateForSQL = date => date.toISOString().slice(0, 19).replace('T', ' ');

    // Common query components
    let periodExpression, groupByClause, orderByClause;
    const dateField = "CONVERT_TZ(created_at, '+00:00', '+05:30')";

    switch (period) {
      case 'day':
        periodExpression = `DATE(${dateField}) AS period_label`;
        groupByClause = 'period_label';
        orderByClause = 'period_label DESC';
        break;
      case 'week':
        periodExpression = `FLOOR((DAYOFMONTH(${dateField}) - 1) / 7) + 1 AS period_number`;
        groupByClause = 'period_number';
        orderByClause = 'period_number';
        break;
      case 'month':
        periodExpression = `MONTH(${dateField}) AS period_number`;
        groupByClause = 'period_number';
        orderByClause = 'period_number';
        break;
      case 'year':
        periodExpression = `YEAR(${dateField}) AS period_number`;
        groupByClause = 'period_number';
        orderByClause = 'period_number DESC';
        break;
    }

    // Build main query
    let metricField, whereClause = '';
    const queryParams = [restaurant_id];

    if (reports === 'orders') {
      metricField = 'COUNT(*) AS value';
    } else if (reports === 'revenue') {
      metricField = 'SUM(res_amount) AS value';
      whereClause = 'AND order_status NOT IN (?, ?)';
      queryParams.push('pending', 'cancelled');
    } else {
      return next(new AppError(400, 'Invalid report type. Use: orders or revenue.'));
    }

    queryParams.push(formatDateForSQL(start), formatDateForSQL(end));

    const graphQuery = `
      SELECT 
        ${periodExpression},
        ${metricField}
      FROM orders
      WHERE restaurant_id = ?
      ${whereClause}
      AND created_at BETWEEN ? AND ?
      GROUP BY ${groupByClause}
      ORDER BY ${orderByClause};
    `;

    // Fetch data
    const [graphData] = await pool.query(graphQuery, queryParams);
    const [allData] = await pool.query(getAllDataQuery(reports), [restaurant_id]);

    // Format graph labels
    const formattedGraphData = graphData.map(item => {
      const label = period === 'day' 
        ? item.period_label 
        : period === 'week'
        ? `Week ${item.period_number}`
        : period === 'month'
        ? new Date(2000, item.period_number - 1).toLocaleString('default', { month: 'long' })
        : item.period_number.toString();
      
      return { label, value: Number(item.value).toFixed(2) };
    });

    return res.status(200).json({
      status: "success",
      data: { 
        graphData: formattedGraphData,
        allData: allData[0] 
      }
    });

  } catch (err) {
    console.error(err);
    return next(new AppError(500, "Internal Server Error", err));
  }
});

// Helper function for allData queries
function getAllDataQuery(reportType) {
  return reportType === 'orders' ? 
    `SELECT
      COUNT(*) AS total_orders,
      SUM(order_status = 'cancelled') AS cancelled_orders,
      SUM(order_status IN ('delivered', 'completed')) AS completed_orders
     FROM orders
     WHERE restaurant_id = ?` :
    `SELECT
      SUM(b.payment_type = 'cod') AS COD_payment,
      SUM(b.payment_type != 'cod') AS online_payment,
      ROUND(SUM(b.payment_type = 'cod') / COUNT(o.bill_id) * 100, 2) AS COD_payment_percentage,
      ROUND(SUM(b.payment_type != 'cod') / COUNT(o.bill_id) * 100, 2) AS online_payment_percentage
     FROM orders o
     LEFT JOIN bills b ON o.bill_id = b.id
     WHERE o.restaurant_id = ?`;
}

exports.getSellerDashboard = asyncChoke(async (req, res, next) => {
  const { id: restaurant_id } = req.user;
  const { date: selectedDateParam, period = 'day' } = req.query;

  try {
    const selectedDate = selectedDateParam ? new Date(selectedDateParam) : new Date();

    // Function to calculate UTC date range based on period and selected date
    const getUTCDateRange = (period, date) => {
      const tzOffsetMinutes = 330; // +05:30 timezone offset in minutes
      const tzOffsetMs = tzOffsetMinutes * 60 * 1000;
      let start, end;

      switch (period) {
        case 'day': {
          const localStart = new Date(date);
          localStart.setDate(localStart.getDate() - 6);
          localStart.setHours(0, 0, 0, 0);
          start = new Date(localStart.getTime() - tzOffsetMs);

          const localEnd = new Date(date);
          localEnd.setHours(23, 59, 59, 999);
          end = new Date(localEnd.getTime() - tzOffsetMs);
          break;
        }
        case 'week': {
          const localStart = new Date(date.getFullYear(), date.getMonth(), 1);
          localStart.setHours(0, 0, 0, 0);
          start = new Date(localStart.getTime() - tzOffsetMs);

          const localEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
          localEnd.setHours(23, 59, 59, 999);
          end = new Date(localEnd.getTime() - tzOffsetMs);
          break;
        }
        case 'month': {
          const localStart = new Date(date.getFullYear(), 0, 1);
          localStart.setHours(0, 0, 0, 0);
          start = new Date(localStart.getTime() - tzOffsetMs);

          const localEnd = new Date(date.getFullYear(), 11, 31);
          localEnd.setHours(23, 59, 59, 999);
          end = new Date(localEnd.getTime() - tzOffsetMs);
          break;
        }
        case 'year': {
          const year = date.getFullYear();
          const localStart = new Date(year - 4, 0, 1);
          localStart.setHours(0, 0, 0, 0);
          start = new Date(localStart.getTime() - tzOffsetMs);

          const localEnd = new Date(year, 11, 31);
          localEnd.setHours(23, 59, 59, 999);
          end = new Date(localEnd.getTime() - tzOffsetMs);
          break;
        }
        default:
          throw new Error('Invalid period');
      }

      return { start, end };
    };

    const { start, end } = getUTCDateRange(period, selectedDate);
    const formatDateForSQL = (date) => date.toISOString().slice(0, 19).replace('T', ' ');
    const startDateStr = formatDateForSQL(start);
    const endDateStr = formatDateForSQL(end);

    let periodLabelExpression, groupByClause, orderByClause;

    switch (period) {
      case 'day':
        periodLabelExpression = `DATE(CONVERT_TZ(created_at, '+00:00', '+05:30')) AS period_label`;
        groupByClause = 'period_label';
        orderByClause = 'period_label DESC';
        break;
      case 'week':
        periodLabelExpression = `FLOOR((DAYOFMONTH(CONVERT_TZ(created_at, '+00:00', '+05:30')) - 1) / 7) + 1 AS period_number`;
        groupByClause = 'period_number';
        orderByClause = 'period_number';
        break;
      case 'month':
        periodLabelExpression = `MONTH(CONVERT_TZ(created_at, '+00:00', '+05:30')) AS period_number`;
        groupByClause = 'period_number';
        orderByClause = 'period_number';
        break;
      case 'year':
        periodLabelExpression = `YEAR(CONVERT_TZ(created_at, '+00:00', '+05:30')) AS period_number`;
        groupByClause = 'period_number';
        orderByClause = 'period_number DESC';
        break;
      default:
        periodLabelExpression = `DATE(CONVERT_TZ(created_at, '+00:00', '+05:30')) AS period_label`;
        groupByClause = 'period_label';
        orderByClause = 'period_label DESC';
    }

    const graphQuery = `
      SELECT 
        ${periodLabelExpression},
        COUNT(*) AS order_count,
        SUM(res_amount) AS total_amount
      FROM 
        orders
      WHERE 
        restaurant_id = ?
        AND order_status NOT IN (?, ?, ?)
        AND created_at BETWEEN ? AND ?
      GROUP BY 
        ${groupByClause}
      ORDER BY 
        ${orderByClause};
    `;

    const [graphData] = await pool.query(graphQuery, [
      restaurant_id,
      'pending',
      'confirmed',
      'cancelled',
      startDateStr,
      endDateStr,
    ]);

    // Format graph data based on period
    let formattedGraphData;
    switch (period) {
      case 'day':
        formattedGraphData = graphData.map(item => ({
          date: item.period_label,
          totalOrders: item.order_count,
          totalRevenue: parseFloat(item.total_amount).toFixed(2),
        }));
        break;
      case 'week':
        formattedGraphData = graphData.map(item => ({
          date: `Week ${item.period_number}`,
          totalOrders: item.order_count,
          totalRevenue: parseFloat(item.total_amount).toFixed(2),
        }));
        break;
      case 'month': {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'];
        formattedGraphData = graphData.map(item => ({
          date: monthNames[item.period_number - 1],
          totalOrders: item.order_count,
          totalRevenue: parseFloat(item.total_amount).toFixed(2),
        }));
        break;
      }
      case 'year':
        formattedGraphData = graphData.map(item => ({
          date: item.period_number.toString(),
          totalOrders: item.order_count,
          totalRevenue: parseFloat(item.total_amount).toFixed(2),
        }));
        break;
      default:
        formattedGraphData = [];
    }

    // The rest of your existing code for mainData...

    return res.status(200).json({
      status: "success",
      data: {
        mainData: { /* ... existing mainData ... */ },
        graphData: formattedGraphData,
      },
    });
  } catch (err) {
    console.error(err);
    return next(new AppError(500, "Internal Server Error while fetching dashboard data", err));
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
      restaurants.profile,
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
      restaurants.approved = ?
    GROUP BY 
      restaurants.id, restaurants.restaurant_name, restaurantaddress.latitude, restaurantaddress.longitude, restaurants.cooking_time
    HAVING 
      distance <= ? -- Only fetch restaurants within the circular_radius using Haversine
    ORDER BY 
      avg_rating DESC;
  `;



  // Execute the query with user's location and circular radius for Haversine formula
  const [rows] = await pool.query(query, [latitude, longitude, latitude, "approved", circular_radius]);

  if (rows.length === 0) {
    return next(new AppError(404, "Restaurants not found in your location"));
  }

  // Function to calculate distance and time using OpenRouteService API
  // const calculateDistanceAndTime = async (userLat, userLon, restLat, restLon) => {
  //   const API_KEY = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  //   const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${API_KEY}&start=${userLon},${userLat}&end=${restLon},${restLat}`;
  //   try {
  //     const response = await axios.get(url);
  //     const segment = response.data.features[0].properties.segments[0];
  //     const distanceInKilometers = segment.distance / 1000; // Convert meters to kilometers
  //     const timeInMinutes = segment.duration / 60; // Convert seconds to minutes

  //     return {
  //       distance: distanceInKilometers.toFixed(2),
  //       time: Math.ceil(timeInMinutes),
  //     };
  //   } catch (err) {
  //     console.error("Error fetching distance and time:", err.message);
  //     return null;
  //   }
  // };

  // Array to store restaurant data with distance and time
  const data = [];

  // Loop through each restaurant and calculate distance and time
  for (const restaurant of rows) {
    const result = await getRouteDistance(
      latitude,
      longitude,
      restaurant.restaurant_lat,
      restaurant.restaurant_lng
    );
    // console.log(result);
    if (result && result.distance <= route_distance) {
      const cookingTime = restaurant.cooking_time || 0; // Default cooking time to 0 if null

      const duration = result.duration.split(' min').toString()
      console.log(duration);
      // Calculate total delivery time: cooking time + delivery time + buffer time from app settings
      let totalDeliveryTime = 
    Number(cookingTime) + Number(result.durationValue/60) + Number(buffer_time);
    totalDeliveryTime = Number(totalDeliveryTime.toFixed())
    


      data.push({
        restaurant_id: restaurant.restaurant_id,
        restaurant_name: restaurant.restaurant_name,
        profile: restaurant.profile,
        distance: result.distance,
        avg_rating: parseFloat(restaurant.avg_rating).toFixed(1),
        delivery_time: totalDeliveryTime, // Total time to reach the user
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
      restaurants.profile,
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
      restaurants.approved = ?
    GROUP BY 
      restaurants.id, restaurants.restaurant_name, restaurantaddress.latitude, restaurantaddress.longitude, restaurants.cooking_time
    HAVING 
      distance <= ? -- Filter based on circular_radius
    ORDER BY 
      avg_rating DESC;
  `;

  // Execute the query with user's location and circular_radius
  const [rows] = await pool.query(query, [latitude, longitude, latitude, "approved", circular_radius]);

  if (rows.length === 0) {
    return next(new AppError(404, "No top-rated restaurants found within the configured circular radius"));
  }

  // OpenRouteService API call to calculate precise distance and duration
  // const calculateDistanceAndTime = async (userLat, userLon, restLat, restLon) => {
  //   const API_KEY = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  //   const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${API_KEY}&start=${userLon},${userLat}&end=${restLon},${restLat}`;
  //   try {
  //     const response = await axios.get(url);
  //     const segment = response.data.features[0].properties.segments[0];
  //     const distanceInKilometers = segment.distance / 1000; // Convert meters to kilometers
  //     const timeInMinutes = segment.duration / 60; // Convert seconds to minutes

  //     return {
  //       distance: distanceInKilometers.toFixed(2),
  //       time: Math.ceil(timeInMinutes),
  //     };
  //   } catch (err) {
  //     console.error("Error fetching distance and time:", err.message);
  //     return null;
  //   }
  // };

  // Prepare response data
  const data = [];

  for (const restaurant of rows) {
    const result = await getRouteDistance(
      latitude,
      longitude,
      restaurant.restaurant_lat,
      restaurant.restaurant_lng
    );

    // Check if the OpenRouteService distance is within the route_distance
    if (result && result.distance <= route_distance) {
      const cookingTime = restaurant.cooking_time || 0; // Default cooking time to 0 if null

      // Calculate total delivery time: cooking time + travel time + buffer time
      let totalDeliveryTime = 
    Number(cookingTime) + Number(result.durationValue/60) + Number(buffer_time);
    totalDeliveryTime = Number(totalDeliveryTime.toFixed())

      data.push({
        restaurant_id: restaurant.restaurant_id,
        restaurant_name: restaurant.restaurant_name,
        profile: restaurant.profile,
        distance: result.distance, // Distance from OpenRouteService
        avg_rating: parseFloat(restaurant.avg_rating).toFixed(1),
        delivery_time: totalDeliveryTime,
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
      restaurants.profile,
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
      restaurants.approved = ?
    GROUP BY 
      restaurants.id, restaurants.restaurant_name, restaurantaddress.latitude, restaurantaddress.longitude, restaurants.cooking_time
    HAVING 
      distance <= ? -- Filter restaurants within the circular_radius
    ORDER BY 
      restaurants.order_count DESC; -- Sort by order_count in descending order
  `;

  // Execute the query with parameterized values
  const [rows] = await pool.query(query, [latitude, longitude, latitude,"approved", circular_radius]);
  if (rows.length === 0) {
    return next(
      new AppError(404, "No popular restaurants found within the configured circular radius")
    );
  }

  // OpenRouteService API call to calculate precise distance and time
  // const calculateDistanceAndTime = async (userLat, userLon, restLat, restLon) => {
  //   const API_KEY = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  //   const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${API_KEY}&start=${userLon},${userLat}&end=${restLon},${restLat}`;
  //   try {
  //     const response = await axios.get(url);
  //     const segment = response.data.features[0].properties.segments[0];
  //     const distanceInKilometers = segment.distance / 1000; // Convert meters to kilometers
  //     const timeInMinutes = segment.duration / 60; // Convert seconds to minutes

  //     return {
  //       distance: distanceInKilometers.toFixed(2),
  //       time: Math.ceil(timeInMinutes),
  //     };
  //   } catch (err) {
  //     console.error("Error fetching distance and time:", err.message);
  //     return null;
  //   }
  // };

  // Prepare response data
  const data = [];

  for (const restaurant of rows) {
    const result = await getRouteDistance(
      latitude,
      longitude,
      restaurant.restaurant_lat,
      restaurant.restaurant_lng
    );

    // Check if the OpenRouteService distance is within the route_distance
    if (result && result.distance <= route_distance) {
      const cookingTime = restaurant.cooking_time || 0; // Default cooking time to 0 if null

      // Calculate total delivery time: cooking time + travel time + buffer time
      let totalDeliveryTime = 
    Number(cookingTime) + Number(result.durationValue/60) + Number(buffer_time);
    totalDeliveryTime = Number(totalDeliveryTime.toFixed())

      data.push({
        restaurant_id: restaurant.restaurant_id,
        restaurant_name: restaurant.restaurant_name,
        profile: restaurant.profile,
        distance: result.distance, 
        avg_rating: parseFloat(restaurant.avg_rating).toFixed(1),
        order_count: restaurant.order_count,
        delivery_time: totalDeliveryTime,
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
      restaurants.profile,
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
      restaurants.approved = ?
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
    "approved",
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
  // const calculateDistanceAndTime = async (userLat, userLon, restLat, restLon) => {
  //   const API_KEY = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  //   const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${API_KEY}&start=${userLon},${userLat}&end=${restLon},${restLat}`;
  //   try {
  //     const response = await axios.get(url);
  //     const segment = response.data.features[0].properties.segments[0];
  //     const distanceInKilometers = segment.distance / 1000; // Convert meters to kilometers
  //     const timeInMinutes = segment.duration / 60; // Convert seconds to minutes

  //     return {
  //       distance: distanceInKilometers.toFixed(2),
  //       time: Math.ceil(timeInMinutes),
  //     };
  //   } catch (err) {
  //     console.error("Error fetching distance and time:", err.message);
  //     return null;
  //   }
  // };

  

  // Array to store restaurant data with distance and time
  const data = [];

  // Loop through each restaurant and calculate distance and time
  for (const row of rows) {
    const result = await getRouteDistance(
      latitude,
      longitude,
      row.restaurant_lat,
      row.restaurant_lng
    );
    console.log(result);

    if (result && result.distance <= route_distance) {
      const cookingTime = row.cooking_time || 0; // Default cooking time to 0 if null

      // Calculate total delivery time: cooking time + delivery time + buffer time from app settings
      let totalDeliveryTime = 
    Number(cookingTime) + Number(result.durationValue/60) + Number(buffer_time);
    totalDeliveryTime = Number(totalDeliveryTime.toFixed())

      data.push({
        restaurant_id: row.restaurant_id,
        restaurant_name: row.restaurant_name,
        profile: row.profile,
        distance: result.distance,
        distance: result.distance,
        avg_rating: parseFloat(row.avg_rating).toFixed(1),
        delivery_time: totalDeliveryTime,
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
  const doc = req.files;

  if (!approved || approved !== "approved") {
    return next(
      new AppError(403, "You are not authorized to update this restaurant")
    );
  }

  // // Check if required fields are provided
  // if (!owner_name || !owner_phone_no || !owner_email ||
  //   !street || !landmark || !area || !pincode || !city || !state || !latitude || !longitude) {
  //   return next(new AppError(400, "All fields are required"));
  // }


  // Validate email
  if(owner_email && owner_phone_no){
    if (!validateEmail(owner_email)) {
      return next(new AppError(400, "Please enter a valid email"));
    }
    if(!isValidPhoneNumber(owner_phone_no)){
      return next(new AppError(400, "Please enter a valid phone number"));
    }
  }
  let profileUrl;
  if(doc.profile){
    profileUrl = await uploadFile(doc.profile);
    console.log("profile doc:", doc);
  }

  const query =
    `UPDATE restaurants 
    SET 
      owner_name = ?, 
      owner_phone_no = ?, 
      owner_email = ?, 
      profile = ? 
    WHERE id = ?`;
  const values = [
    owner_name, 
    owner_phone_no, 
    owner_email, 
    profileUrl,
    id
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
    `SELECT owner_name, owner_phone_no, owner_email, restaurant_name , profile
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
      `SELECT o.id AS order_id, o.order_status, o.restaurant_id, r.restaurant_name, o.user_id, o.del_amount,ra.street, ra.landmark, ra.area, ra.latitude AS restaurant_latitude, ra.longitude AS restaurant_longitude, ua.lat AS user_latitude, ua.lon AS user_longitude
       FROM orders o
       JOIN restaurantaddress ra ON o.restaurant_id = ra.restaurant_id
       JOIN useraddress ua ON o.user_id = ua.user_id
       JOIN restaurants r ON o.restaurant_id = r.id
       WHERE o.id = ? AND o.restaurant_id = ? AND ua.selected = ?`,
      [order_id, restaurant_id, 1]
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
    console.log(order[0]);

    if (type === "cancel") {
      order_status = "cancelled";
    }

    if (type === "confirm") {
      order_status = "confirmed";
    }

    // Calculate restaurant to user distance
    const calculateRouteDetails = async (startLat, startLon, endLat, endLon) => {
      const API_KEY = process.env.OPEN_ROUTE_SERVICE_API_KEY;
      const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${API_KEY}&start=${startLon},${startLat}&end=${endLon},${endLat}`;
      
      try {
        const response = await axios.get(url);
        const segment = response.data.features[0].properties.segments[0];
        return {
          total_distance: (segment.distance / 1000).toFixed(2), // in km
          estimated_time: Math.ceil(segment.duration / 60) // in minutes
        };
      } catch (err) {
        console.error("Routing error:", err.message);
        return null;
      }
    };

    // Get route details from restaurant to user
    const restaurantToUserRoute = await calculateRouteDetails(
      order[0].restaurant_latitude,
      order[0].restaurant_longitude,
      order[0].user_latitude,
      order[0].user_longitude
    );

    // Prepare base order details
    const orderDetails = {
      ...order[0],
      route_details: restaurantToUserRoute || { 
        total_distance: null, 
        estimated_time: null 
      }
    };

    // Update order status
    await pool.query("UPDATE orders SET order_status = ? WHERE id = ?", [order_status, order_id]);

    // Notify user
    const io = getSocketIoServer();
    if (io.connectedUsers[order[0].user_id]) {
      io.to(io.connectedUsers[order[0].user_id]).emit("orderStatus", {
        status: order_status,
        message: `Order ${order_id} ${order_status} by restaurant`,
        details: orderDetails
      });
    }

    if (order_status === "confirmed") {
      const notifyDeliveryBoys = async () => {
        const restaurantLocation = {
          lat: order[0].restaurant_latitude,
          lng: order[0].restaurant_longitude
        };

        for (const deliveryBoyId in io.connectedDeliveryBoys) {
          const deliveryBoy = io.connectedDeliveryBoys[deliveryBoyId];
          
          if (deliveryBoy.status === "online") {
            try {
              // Calculate route from delivery boy to restaurant
              const deliveryBoyToRestaurant = await calculateRouteDetails(
                deliveryBoy.location.lat,
                deliveryBoy.location.lng,
                restaurantLocation.lat,
                restaurantLocation.lng
              );

              if (!deliveryBoyToRestaurant) continue;

              // Check if within 10km driving distance
              if (deliveryBoyToRestaurant.total_distance <= 10) {
                // Calculate full route (delivery boy -> restaurant -> user)
                const fullRoute = await calculateRouteDetails(
                  deliveryBoy.location.lat,
                  deliveryBoy.location.lng,
                  order[0].user_latitude,
                  order[0].user_longitude
                );

                io.to(deliveryBoy.socketId).emit("newOrderNotification", {
                  message: `New order from ${order[0].restaurant_name}`,
                  orderDetails: {
                    ...orderDetails,
                    delivery_boy_route: {
                      to_restaurant: deliveryBoyToRestaurant,
                      full_journey: fullRoute
                    }
                  }
                });
              }
            } catch (err) {
              console.error(`Error notifying delivery boy ${deliveryBoyId}:`, err);
            }
          }
        }
      };

      // Run notifications in background
      notifyDeliveryBoys();
    }

    res.status(200).json({
      status: "Success",
      message: `Order ${order_id} processed`,
      route_details: restaurantToUserRoute
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
        .json({ message: "Login success", token, data: checkQuery[0], approved: approved });
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
          .json({ message: "Account created successfully", token });
      } else {
        return next(new AppError(401, "SignUp Error"));
      }
    } else {
      return next(new AppError(401, "Invalid OTP"));
    }
  }
});
