const { pool } = require("../Config/database");
const AppError = require("../Utils/error");
const { asyncChoke } = require("../Utils/asyncWrapper");
const { createSendToken, validateEmail, calculateGrowthRate } = require("../Utils/utils");
const { uploadFile } = require("../Config/aws");


exports.adminLogin = asyncChoke(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate email and password
  if (!email || !password) {
    return next(new AppError(400, "Email and password are required"));
  }

  if (!validateEmail(email)) {
    return next(new AppError(400, "Please enter a valid email"));
  }

  // Query to find admin by email
  const query = `
    SELECT * 
    FROM admin 
    WHERE email = ?
  `;

  const [admins] = await pool.query(query, [email]);

  // Check if admin exists
  if (admins.length === 0) {
    return next(new AppError(401, "Invalid email or password"));
  }

  const admin = admins[0];

  // Validate the password (plain comparison)
  if (admin.password !== password) {
    return next(new AppError(401, "Invalid email or password"));
  }

  // Generate token using the helper function
  const token = createSendToken(res, req, admin.email, "admin");

  // Send response with token
  res.status(200).json({
    status: "Success",
    token,
    data: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
    },
  });
});

exports.getAdminDashboard = asyncChoke(async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return next(new AppError(400, "Please provide start_date and end_date"));
    }

    // Fetch revenue graph data
    const [revenueGraphResult] = await pool.query(
      `SELECT DATE(created_at) AS date, SUM(platform_amount) AS totalRevenue
       FROM orders
       WHERE DATE(created_at) BETWEEN ? AND ?
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at)`,
      [start_date, end_date]
    );

    // Fetch current period metrics
    const [currentMetricsResult] = await pool.query(
      `SELECT 
         SUM(platform_amount) AS totalRevenue, 
         SUM(CASE WHEN DATE(created_at) = CURDATE() THEN platform_amount ELSE 0 END) AS todayEarnings, 
         COUNT(CASE WHEN order_status = 'arrived' THEN 1 ELSE NULL END) AS completedOrders, 
         COUNT(CASE WHEN order_status NOT IN ('arrived', 'cancelled', 'pending') THEN 1 ELSE NULL END) AS activeOrders 
       FROM orders
       WHERE DATE(created_at) BETWEEN ? AND ?`,
      [start_date, end_date]
    );

    const {
      totalRevenue = 0,
      todayEarnings = 0,
      completedOrders = 0,
      activeOrders = 0,
    } = currentMetricsResult[0];

    // Calculate previous period dates
    const dateRange = new Date(new Date(end_date) - new Date(start_date));
    const previousStartDate = new Date(new Date(start_date) - dateRange);
    const previousEndDate = new Date(new Date(end_date) - dateRange);

    // Fetch previous period metrics
    const [previousMetricsResult] = await pool.query(
      `SELECT 
         SUM(platform_amount) AS totalRevenue, 
         SUM(CASE WHEN DATE(created_at) = CURDATE() - INTERVAL 1 DAY THEN platform_amount ELSE 0 END) AS todayEarnings, 
         COUNT(CASE WHEN order_status = 'arrived' THEN 1 ELSE NULL END) AS completedOrders, 
         COUNT(CASE WHEN order_status NOT IN ('arrived', 'cancelled', 'pending') THEN 1 ELSE NULL END) AS activeOrders 
       FROM orders
       WHERE DATE(created_at) BETWEEN ? AND ?`,
      [previousStartDate, previousEndDate]
    );

    const {
      totalRevenue: prevTotalRevenue = 0,
      todayEarnings: prevTodayEarnings = 0,
      completedOrders: prevCompletedOrders = 0,
      activeOrders: prevActiveOrders = 0,
    } = previousMetricsResult[0];

    

    const totalRevenueGrowth = calculateGrowthRate(totalRevenue, prevTotalRevenue);
    const todayEarningsGrowth = calculateGrowthRate(todayEarnings, prevTodayEarnings);
    const completedOrdersGrowth = calculateGrowthRate(completedOrders, prevCompletedOrders);
    const activeOrdersGrowth = calculateGrowthRate(activeOrders, prevActiveOrders);

    // Fetch top restaurants
    const [topRestaurantsResult] = await pool.query(
      `SELECT r.id AS restaurant_id, r.restaurant_name, r.owner_name, r.owner_email, r.owner_phone_no, r.order_count 
       FROM restaurants r
       ORDER BY r.order_count DESC
       LIMIT 5`
    );

    const restaurantIds = topRestaurantsResult.map(r => r.restaurant_id);
    const [addressDetailsResult] = await pool.query(
      `SELECT ra.restaurant_id, ra.street, ra.landmark, ra.area, ra.pincode, ra.city, ra.state, ra.latitude, ra.longitude, r.order_count
       FROM restaurantaddress ra
       JOIN restaurants r ON ra.restaurant_id = r.id
       WHERE ra.restaurant_id IN (?)`,
      [restaurantIds]
    );

    // Respond with the fixed dashboard data
    res.status(200).json({
      status: "Success",
      data: {
        totalRevenue: parseFloat(totalRevenue).toFixed(2),  // Ensure it's a number
        totalRevenueGrowth: `${totalRevenueGrowth.toFixed(2)}%`,
        todayEarnings: parseFloat(todayEarnings).toFixed(2),  // Ensure it's a number
        todayEarningsGrowth: `${todayEarningsGrowth.toFixed(2)}%`,
        completedOrders,
        completedOrdersGrowth: `${completedOrdersGrowth.toFixed(2)}%`,
        activeOrders,
        activeOrdersGrowth: `${activeOrdersGrowth.toFixed(2)}%`,
        revenueGraph: revenueGraphResult.map(item => ({
          date: item.date,
          totalRevenue: parseFloat(item.totalRevenue || 0).toFixed(2),
        })),
        topRestaurants: topRestaurantsResult.map(item => ({
          restaurant_id: item.restaurant_id,
          restaurant_name: item.restaurant_name || "N/A",
          owner_name: item.owner_name || "N/A",
          owner_email: item.owner_email || "N/A",
          owner_phone_no: item.owner_phone_no || "N/A",
          order_count: parseInt(item.order_count || 0, 10),
        })),
        topLocations: addressDetailsResult.map(item => ({
          restaurant_id: item.restaurant_id,
          street: item.street || "N/A",
          landmark: item.landmark || "N/A",
          area: item.area || "N/A",
          pincode: item.pincode || "N/A",
          city: item.city || "N/A",
          state: item.state || "N/A",
          latitude: parseFloat(item.latitude || 0),
          longitude: parseFloat(item.longitude || 0),
          order_count: parseInt(item.order_count || 0, 10),
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return next(new AppError(500, "Failed to fetch dashboard data"));
  }
});







exports.updateAppSettings = asyncChoke(async (req, res, next) => {
  const {
    circular_radius,
    route_distance,
    buffer_time,
    per_km_fee,
    platform_fee,
    restaurant_charges_rate,
  } = req.body;

  try {
    // Update all settings directly with a single query
    const query = `
      UPDATE app_settings 
      SET 
        circular_radius = ?, 
        route_distance = ?, 
        buffer_time = ?, 
        per_km_fee = ?, 
        platform_fee = ?, 
        restaurant_charges_rate = ?
      WHERE id = 1
    `;

    // Execute the query with provided values
    const [result] = await pool.query(query, [
      circular_radius,
      route_distance,
      buffer_time,
      per_km_fee,
      platform_fee,
      restaurant_charges_rate,
    ]);

    if (result.affectedRows === 0) {
      return next(new AppError(404, "Failed to update app settings."));
    }

    // Respond with success message
    res.status(200).json({
      status: "success",
      message: "App settings updated successfully.",
    });
  } catch (error) {
    console.error("Error updating app settings:", error);
    return next(new AppError(500, "Failed to update app settings."));
  }
});

exports.getAppSettings = asyncChoke(async (req, res, next) => {
  try {
    const [result] = await pool.query("SELECT * FROM app_settings");
    if (result.length === 0) {
      return next(new AppError(404, "App settings not found."));
    }
    const appSettings = result[0];
    res.status(200).json({
      status: "success",
      data: appSettings,
    });
  } catch (error) {
    console.error("Error fetching app settings:", error);
    return next(new AppError(500, "Failed to fetch app settings."));
  }
});






exports.getRestaurantsAdmin = asyncChoke(async (req, res, next) => {
  const { approvalType } = req.query;
  try {
    if (approvalType !== "pending" && approvalType !== "approved" && approvalType !== "declined") {
      return next(
        new AppError(
          400,
          "Invalid approval type! Please provide pending or approved for restaurants."
        )
      );
    }
    
    const qurey = `SELECT 
  -- Restaurant Information
  r.id AS restaurant_id,
  r.owner_name,
  r.owner_email,
  r.owner_phone_no,
  r.restaurant_name,
  r.approved,
  r.updated_at,
  
  -- Restaurant Address Information
  ra.id AS address_id,
  ra.street,
  ra.landmark,
  ra.area,
  ra.pincode,
  ra.city,
  ra.state,
  ra.latitude,
  ra.longitude,
  
  -- Restaurant Documents Information
  rd.id AS document_id,
  rd.pan_no AS doc_pan_no,
  rd.GSTIN_no AS doc_GSTIN_no,
  rd.FSSAI_no AS doc_FSSAI_no,
  rd.outlet_type AS doc_outlet_type,
  rd.bank_IFSC AS doc_bank_IFSC,
  rd.bank_account_no AS doc_bank_account_no,
  
  -- Restaurant Working Hours Information
  rw.id AS working_id,
  rw.monday,
  rw.tuesday,
  rw.wednesday,
  rw.thursday,
  rw.friday,
  rw.saturday,
  rw.sunday,
  rw.opening_time,
  rw.closing_time
  
FROM restaurants r
LEFT JOIN restaurantaddress ra ON ra.restaurant_id = r.id
LEFT JOIN restaurant_docs rd ON rd.restaurant_id = r.id
LEFT JOIN restaurants_working rw ON rw.restaurant_id = r.id
WHERE approved = ?;
`;
    const [results] = await pool.query(qurey, [approvalType]);
    const structuredData = results.map((row) => ({
      restaurant_info: {
        id: row.restaurant_id,
        owner_name: row.owner_name,
        owner_email: row.owner_email,
        owner_phone_no: row.owner_phone_no,
        restaurant_name: row.restaurant_name,
        pan_no: row.pan_no,
        GSTIN_no: row.GSTIN_no,
        FSSAI_no: row.FSSAI_no,
        outlet_type: row.outlet_type,
        bank_IFSC: row.bank_IFSC,
        bank_account_no: row.bank_account_no,
        approved: row.approved,
        updated_at: row.updated_at,
      },
      address_info: {
        id: row.address_id,
        street: row.street,
        landmark: row.landmark,
        area: row.area,
        pincode: row.pincode,
        city: row.city,
        state: row.state,
        latitude: row.latitude,
        longitude: row.longitude,
      },
      documents_info: {
        id: row.document_id,
        pan_no: row.doc_pan_no,
        GSTIN_no: row.doc_GSTIN_no,
        FSSAI_no: row.doc_FSSAI_no,
        outlet_type: row.doc_outlet_type,
        bank_IFSC: row.doc_bank_IFSC,
        bank_account_no: row.doc_bank_account_no,
      },
      working_info: {
        id: row.working_id,
        monday: row.monday,
        tuesday: row.tuesday,
        wednesday: row.wednesday,
        thursday: row.thursday,
        friday: row.friday,
        saturday: row.saturday,
        sunday: row.sunday,
        opening_time: row.opening_time,
        closing_time: row.closing_time,
      },
    }));

    if (results.length > 0) {
      res.status(200).json({
        status: "Success",
        data: structuredData,
      });
    } else {
      return next(new AppError(404, `No Restaurant Approvals Found!`));
    }
  } catch (error) {
    res.status(500).json({
      status: "Error",
      message: "Internal server error",
    });
  }
});

exports.approveRestaurants = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  const { approvalType } = req.query;
  try {
    if (approvalType !== "decline" && approvalType !== "approved") {
      return next(
        new AppError(
          400,
          "Invalid approval type! Please provide pending or approved for restaurants."
        )
      );
    }
    let approval;
    if (approvalType === "approved") {
      approval = "approved";
    } else if (approvalType === "decline") {
      approval = "declined";
    }

    const [check] = await pool.query(`SELECT * FROM restaurants WHERE id = ?`, [
      id,
    ]);
    if (check.length <= 0) {
      return next(new AppError(404, `Restaurant with id '${id}' not found`));
    }
    if (check[0].approved === 1 && approval === 1) {
      return next(
        new AppError(400, `Restaurant with id '${id}' is already approved`)
      );
    }

    const query = `UPDATE restaurants SET approved = ? where id = ?`;
    const result = await pool.query(query, [approval, id]);
    if (result.affectedRows === 0) {
      return next(
        new AppError(400, `can't ${approvalType} restaurant with id '${id}'`)
      );
    }
    const [check2] = await pool.query(
      `SELECT * FROM menus WHERE restaurant_id = ?`,
      [id]
    );
    if (check2.length === 0) {
      const menuAddQuery = `INSERT INTO menus (name,restaurant_id) VALUES (?,?)`;
      const insertValues = [`Menu-${id}`, id];
      const [Menu] = await pool.query(menuAddQuery, insertValues);
      if (Menu.affectedRows === 0) {
        return next(
          new AppError(400, `error while adding menu to this restaurant ${id}`)
        );
      }
    }

    res.status(200).json({
      status: "Success",
      message: `Restaurant with id '${id}' set to ${approvalType} successfully`,
    });
  } catch (err) {
    return next(new AppError(500, "Internal Server Error", err));
  }
});

exports.getDeleveryBoysAdmin = asyncChoke(async (req, res, next) => {
  const { approvalType } = req.query;
  try {
    if (
      approvalType !== "approved" &&
      approvalType !== "pending" &&
      approvalType !== "declined"
    ) {
      return next(
        new AppError(
          400,
          "Invalid approval type. Use approved, pending, declined or all"
        )
      );
    }

    const qurey = `SELECT 
  db.id AS delivery_boy_id,
  db.first_name,
  db.last_name,
  db.gender,
  db.profile_pic,
  db.approved,
  db.phone_no,
  
  dbd.id AS delivery_doc_id,
  dbd.adhar_front,
  dbd.adhar_back,
  dbd.pan_front,
  dbd.pan_back,
  dbd.dl_front,
  dbd.dl_back,
  
  dbb.id AS delivery_bank_id,
  dbb.account_no,
  dbb.bank_name,
  dbb.IFSC_code,
  
  dv.id AS delivery_vehicle_id,
  dv.vehicle_no,
  dv.registration_no,
  dv.vehicle_type,
  dv.vehicle_image,
  
  dw.id AS delivery_work_id,
  dw.type AS work_type,
  dw.work_area
  
FROM delivery_boys db
JOIN delivery_docs dbd ON dbd.del_id = db.id
JOIN delivery_work dw ON dw.del_id = db.id
JOIN delivery_bank dbb ON dbb.del_id = db.id
JOIN delivery_vehicles dv ON dv.del_id = db.id
WHERE db.approved = ?
`;
    const [results] = await pool.query(qurey, [approvalType]);
    const structuredData = results.map((row) => ({
      personal_info: {
        id: row.delivery_boy_id,
        first_name: row.first_name,
        last_name: row.last_name,
        gender: row.gender,
        profile_pic: row.profile_pic,
        approved: row.approved,
        phone_no: row.phone_no,
      },
      documents: {
        id: row.delivery_doc_id,
        adhar_front: row.adhar_front,
        adhar_back: row.adhar_back,
        pan_front: row.pan_front,
        pan_back: row.pan_back,
        dl_front: row.dl_front,
        dl_back: row.dl_back,
      },
      bank_details: {
        id: row.delivery_bank_id,
        account_no: row.account_no,
        bank_name: row.bank_name,
        IFSC_code: row.IFSC_code,
      },
      vehicle_info: {
        id: row.delivery_vehicle_id,
        vehicle_no: row.vehicle_no,
        registration_no: row.registration_no,
        vehicle_type: row.vehicle_type,
        vehicle_image: row.vehicle_image,
      },
      work_info: {
        id: row.delivery_work_id,
        work_type: row.work_type,
        work_area: row.work_area,
      },
    }));
    res.status(200).json({
      status: "Success",
      data: structuredData,
    });
  } catch (error) {
    console.error("Error getting all unApproved DeleveryBoys:", error);
    return next(new AppError(500, "Internal Server Error", error));
  }
});

exports.approveDeleveryBoys = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  const { approveType } = req.query;
  try {
    if (approveType !== "approved" && approveType !== "declined") {
      return next(
        new AppError(
          400,
          "Invalid approval type. Use approved, pending, declined"
        )
      );
    }

    const [check] = await pool.query(
      `SELECT * FROM delivery_boys WHERE id =?`,
      [id]
    );
    if (check.length <= 0) {
      return next(new AppError(404, `Delivery boy with id '${id}' not found`));
    }

    if (approveType === check[0].approved) {
      return next(
        new AppError(
          400,
          `Delivery boy with id '${id}' is already ${approveType}`
        )
      );
    }

    const query = `UPDATE delivery_boys SET approved = ? where id = ?`;

    await pool.query(query, [approveType, id]);

    res.status(200).json({
      status: "Success",
      message: `deliveryBoy with id '${id}' ${approveType} successfully`,
    });
  } catch (error) {
    console.error("Error while Approving DeleveryBoys", error);
    res.status(500).json({
      status: "Error",
      message: "Internal server error",
    });
  }
});

exports.createMainCategory = asyncChoke(async (req, res, next) => {
  const { name} = req.body;

  const doc = req.files;
  let thumbnailUrl
  if (!name) {
    return next(new AppError(400, "Provide name"));
  }
  if(!doc.thumbnail){
    return next(new AppError(400, "Provide thumbnail"));
  }
  thumbnailUrl = await uploadFile(doc.thumbnail)

  const query = `
    INSERT INTO main_categories (name, image_url)
    VALUES (?, ?)
  `;

  const [result] = await pool.query(query, [name, thumbnailUrl]);

  res.status(201).json({
    status: "Success",
    data: {
      id: result.insertId,
      name,
      thumbnailUrl,
    },
  });
});

exports.updateMainCategory = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  const { name } = req.body;
  const doc = req.files;
  let thumbnailUrl
  console.log(name);
  if (!name) {
    return next(new AppError(404, "Provide name!"))
  }
  if(doc.thumbnail){
    thumbnailUrl = await uploadFile(doc.thumbnail)
  }

  const query = `
    UPDATE main_categories
    SET name = COALESCE(?, name), image_url = COALESCE(?, image_url), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  const [result] = await pool.query(query, [name, thumbnailUrl, id]);

  if (result.affectedRows === 0) {
    return next(new AppError(401, "Cannot update categories"));
  }

  res.status(200).json({
    status: "Success",
    message: "Category updated successfully",
  });
});

exports.deleteMainCategory = asyncChoke(async (req, res, next) => {
  const { id } = req.params;

  const query = `
    DELETE FROM main_categories
    WHERE id = ?
  `;

  const [result] = await pool.query(query, [id]);

  if (result.affectedRows === 0) {
    return res.status(404).json({
      status: "Error",
      message: "Category not found",
    });
  }

  res.status(200).json({
    status: "Success",
    message: "Category deleted successfully",
  });
});
