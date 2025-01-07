const { default: axios } = require("axios");
const { pool } = require("../Config/database");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");

exports.getMenuById = asyncChoke(async (req, res, next) => {
  const { id, latitude, longitude } = req.params;
  const { type, filter } = req.query;

  if (!latitude || !longitude) {
    return next(new AppError(400, "Location coordinates not found!"));
  }

  let restaurantDetails = {};

  const [restaurantCheck] = await pool.query(
    `SELECT res.restaurant_name,
      res_rating.rating_count,
      res_address.street,
      res_address.latitude AS restaurant_latitude,
      res_address.longitude AS restaurant_longitude,
      cat.category,
      res.cooking_time
    FROM restaurants res 
    LEFT JOIN restaurantaddress res_address ON res.id = res_address.restaurant_id
    LEFT JOIN restaurants_rating res_rating ON res.id = res_rating.restaurant_id
    LEFT JOIN menus menu ON menu.restaurant_id = res.id
    LEFT JOIN categories cat ON menu.id = cat.menu_id
    WHERE res.id = ?`,
    [id]
  );

  if (restaurantCheck.length === 0) {
    return next(new AppError(404, "Restaurant not found!"));
  }

  // Fetch restaurant working hours and days
  const [workingHours] = await pool.query(
    `SELECT * FROM restaurants_working WHERE restaurant_id = ?`,
    [id]
  );

  if (workingHours.length === 0) {
    return next(new AppError(404, "Restaurant working hours not found"));
  }

  const currentDay = new Date().getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const currentTime = new Date().toTimeString().split(" ")[0]; // HH:MM:SS format

  // Map currentDay to the corresponding column in the database
  const daysMapping = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const currentDayColumn = daysMapping[currentDay];
  const isOpenToday = workingHours[0][currentDayColumn]; // Use correct column name
  const openingTime = workingHours[0].opening_time;
  const closingTime = workingHours[0].closing_time;

  // Check if the restaurant is open
  const isOpen24Hours =
    openingTime === "00:00:00" && closingTime === "23:59:59";

  if (!isOpenToday || (!isOpen24Hours && (currentTime < openingTime || currentTime > closingTime))) {
    return next(new AppError(400, "Restaurant is closed!"));
  }

  const [restaurantAvgRating] = await pool.query(
    `SELECT ROUND(IFNULL(AVG(user_rated_restaurants.rating), 0), 2) AS avg_rating,
            COUNT(user_rated_restaurants.id) AS rating_count
     FROM user_rated_restaurants
     WHERE restaurant_id = ?`,
    [id]
  );

  restaurantDetails = {
    restaurant_name: restaurantCheck[0].restaurant_name,
    street: restaurantCheck[0].street,
    avg_rating: restaurantAvgRating[0].avg_rating,
    rating_count: restaurantAvgRating[0].rating_count,
    categories: restaurantCheck.map((row) => row.category),
    restaurant_latitude: restaurantCheck[0].restaurant_latitude,
    restaurant_longitude: restaurantCheck[0].restaurant_longitude,
    cooking_time: restaurantCheck[0].cooking_time || 0,
  };

  // Fetch app settings
  const settingsQuery = `
    SELECT circular_radius, route_distance, buffer_time
    FROM app_settings
    WHERE id = 1;`;
  const [settings] = await pool.query(settingsQuery);

  if (settings.length === 0) {
    return next(new AppError(404, "App settings not found"));
  }

  const { circular_radius, route_distance, buffer_time } = settings[0];

  // Haversine formula to check if restaurant is in the circular radius
  const haversineDistance = `
    (6371 * acos(
      cos(radians(${latitude})) * cos(radians(${restaurantDetails.restaurant_latitude})) * 
      cos(radians(${restaurantDetails.restaurant_longitude}) - radians(${longitude})) + 
      sin(radians(${latitude})) * sin(radians(${restaurantDetails.restaurant_latitude}))
    ))`;

  const radiusQuery = `
    SELECT ${haversineDistance} AS distance
    FROM restaurants
    WHERE id = ? AND ${haversineDistance} <= ?`;

  const [radiusRows] = await pool.query(radiusQuery, [id, circular_radius]);

  if (radiusRows.length === 0) {
    return next(
      new AppError(404, "Restaurant not found or out of delivery range!")
    );
  }

  // OpenRouteService API for route distance and travel time
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

  const routeResult = await calculateDistanceAndTime(
    latitude,
    longitude,
    restaurantDetails.restaurant_latitude,
    restaurantDetails.restaurant_longitude
  );

  if (!routeResult || routeResult.distance > route_distance) {
    return next(
      new AppError(404, "Restaurant is out of delivery range based on routes!")
    );
  }

  const deliveryTime =
    Number(restaurantDetails.cooking_time) + Number(routeResult.time) + Number(buffer_time);

  // Fetch menu and categories
  const menuIdQuery = "SELECT id FROM menus WHERE restaurant_id = ?";
  const [menuRows] = await pool.query(menuIdQuery, [id]);

  if (menuRows.length === 0) {
    return next(new AppError(404, "Menu not found for this restaurant"));
  }

  const menuId = menuRows[0].id;
  const categoriesQuery = "SELECT * FROM categories WHERE menu_id = ?";
  const [categoriesRows] = await pool.query(categoriesQuery, [menuId]);

  const menuData = { TopSeller: [] };
  let topSellerItems = [];

  for (let category of categoriesRows) {
    const categoryId = category.id;

    const itemsQuery = `
      SELECT items.id,
            items.name,
            items.price,
            items.type,
            items.order_count,
            items.image,
            ROUND(IFNULL(AVG(user_rated_items.rating), 0), 2) AS avg_rating,
            COUNT(user_rated_items.id) AS rating_count
      FROM items
      LEFT JOIN user_rated_items 
      ON items.id = user_rated_items.item_id
      WHERE items.category_id = ? 
            ${type ? "AND items.type = ?" : ""}
      GROUP BY items.id, items.name, items.price, items.type, items.order_count, items.image
      ${filter === "rating" ? "HAVING avg_rating >= 4" : ""}
      ${filter === "best_seller" ? "ORDER BY items.order_count DESC" : ""}
    `;

    const [itemsRows] = await pool.query(
      itemsQuery,
      type ? [categoryId, type] : [categoryId]
    );

    if (itemsRows.length === 0) {
      menuData[category.category] = {
        message: "No items found in this category",
      };
    } else {
      const topItems = itemsRows
        .sort((a, b) => b.order_count - a.order_count)
        .slice(0, 10);

      topSellerItems = [...topSellerItems, ...topItems].slice(0, 10);

      menuData[category.category] = topItems.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        type: item.type,
        order_count: item.order_count,
        avg_rating: item.avg_rating,
        image: item.image,
      }));
    }
  }

  menuData.TopSeller = topSellerItems;

  res.status(200).json({
    status: "Success",
    data: {
      menuId: menuId,
      avgRating: restaurantDetails.avg_rating,
      ratingCount: restaurantDetails.rating_count,
      restaurantName: restaurantDetails.restaurant_name,
      street: restaurantDetails.street,
      deliveryTime: `${deliveryTime} mins`,
      categories: restaurantDetails.categories.slice(0, 2),
      menu: menuData,
    },
  });
});





exports.searchItemsInRestaurant = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  const { search } = req.query;

  if (!id) {
    return next(new AppError(400, "Restaurant ID is required!"));
  }

  if (!search || search.trim().length < 2) {
    return res.status(200).json({
      status: "Success",
      data: [],
    });
  }

  const searchQuery = `%${search}%`;

  const itemsQuery = `
    SELECT 
      items.id AS item_id,
      items.name AS item_name,
      items.price,
      items.description,
      items.type,
      items.order_count,
      items.image,
      cat.category AS category_name
    FROM 
      items
    INNER JOIN 
      categories AS cat ON items.category_id = cat.id
    INNER JOIN 
      menus AS menu ON cat.menu_id = menu.id
    WHERE 
      menu.restaurant_id = ? 
      AND (
        MATCH(items.name) AGAINST(?) 
        OR MATCH(cat.category) AGAINST(?)
        OR items.name LIKE ?
        OR SOUNDEX(items.name) = SOUNDEX(?)
      )
    ORDER BY 
      items.order_count DESC
    LIMIT 50;
  `;

  try {
    const [items] = await pool.query(itemsQuery, [
      id,
      search,
      search,
      searchQuery,
      search,
    ]);

    if (items.length === 0) {
      return res.status(200).json({
        status: "Success",
        data: [],
      });
    }

    const formattedItems = items.map((item) => ({
      item_id: item.item_id,
      name: item.item_name,
      price: parseFloat(item.price).toFixed(2),
      description: item.description || "No description available",
      type: item.type,
      image: item.image,
      order_count: item.order_count,
      category: item.category_name,
    }));

    res.status(200).json({
      status: "Success",
      data: formattedItems,
    });
  } catch (error) {
    console.error("Error fetching items:", error);
    next(new AppError(500, "Internal server error"));
  }
});
