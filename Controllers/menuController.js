const { pool } = require("../Config/database");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");

// READ All Menus by restaurant id
exports.getMenuById = asyncChoke(async (req, res, next) => {
  const { id, latitude, longitude } = req.params;

  if (!latitude || !longitude) {
    return next(new AppError(400, "Location coordinates not found!"));
  }
  
  let restaurantDetails = {};
  const [restaurantCheck] = await pool.query(
    `SELECT res.restaurant_name,
     res_rating.rating_count,
     res_rating.rating,
     res_address.street,
     res_address.latitude AS restaurant_latitude,
     res_address.longitude AS restaurant_longitude,
     cat.category
     FROM restaurants res 
     LEFT JOIN restaurants_rating res_rating
     ON res.id = res_rating.restaurant_id 
     LEFT JOIN restaurantaddress res_address
     ON res.id = res_address.restaurant_id
     LEFT JOIN menus menu
     ON menu.restaurant_id = res.id
     LEFT JOIN categories cat
     ON menu.id = cat.menu_id
     WHERE res.id = ?`,
    [id]
  );

  if (restaurantCheck.length === 0) {
    return next(new AppError(404, "Restaurant not found!"));
  }

  // Extract restaurant details and address
  restaurantDetails = {
    restaurant_name: restaurantCheck[0].restaurant_name,
    street: restaurantCheck[0].street,
    rating_count: restaurantCheck[0].rating_count,
    rating: restaurantCheck[0].rating,
    categories: restaurantCheck.map(row => row.category),
    restaurant_latitude: restaurantCheck[0].restaurant_latitude,
    restaurant_longitude: restaurantCheck[0].restaurant_longitude
  };

  const radius = 10; // Radius in kilometers
  const cookingPackingTime = 10; // Fixed 10 minutes for cooking and packing
  const averageSpeed = 0.5; // 30 km/h = 0.5 km/min
  const bufferTime = 5; // Buffer time in minutes for range

  // Haversine formula to calculate distance
  const haversine = `(6371 * acos(cos(radians(${latitude})) * cos(radians(${restaurantDetails.restaurant_latitude})) * cos(radians(${restaurantDetails.restaurant_longitude}) - radians(${longitude})) + sin(radians(${latitude})) * sin(radians(${restaurantDetails.restaurant_latitude}))))`;

  // Query to check if the restaurant is within the radius
  const radiusQuery = `
    SELECT COUNT(*) AS count, 
    ${haversine} AS distance
    FROM restaurants
    INNER JOIN restaurantaddress 
    ON restaurants.id = restaurantaddress.restaurant_id
    WHERE restaurants.id = ? AND approved = ? AND ${haversine} <= ?
    GROUP BY restaurantaddress.latitude, restaurantaddress.longitude
  `;

  try {
    // Execute the query to check if the restaurant is within the radius
    const [radiusRows] = await pool.query(radiusQuery, [id, true, radius]);

    // Check if restaurant is not found or not within the radius
    if (radiusRows.length === 0 || radiusRows[0].count === 0) {
      return next(new AppError(404, "Restaurant not found or out of delivery range!"));
    }

    // Calculate delivery time
    const distance = radiusRows[0].distance;
    const travelTime = distance / averageSpeed; // in minutes
    const minTime = travelTime - bufferTime + cookingPackingTime; // Minimum time
    const maxTime = travelTime + bufferTime + cookingPackingTime; // Maximum time

    const deliveryTime = `${Math.max(0, Math.floor(minTime))} - ${Math.ceil(maxTime)} min`;

    // Proceed with fetching menu and items as before
    const menuIdQuery = "SELECT id FROM menus WHERE restaurant_id = ?";
    const [menuRows] = await pool.query(menuIdQuery, [id]);

    if (menuRows.length === 0) {
      return next(new AppError(404, "Menu not found for this restaurant"));
    }

    const menuId = menuRows[0].id;
    const categoriesQuery = "SELECT * FROM categories WHERE menu_id = ?";
    const [categoriesRows] = await pool.query(categoriesQuery, [menuId]);

    // Initialize an empty object with "TopSeller" at the top
    const menuData = { TopSeller: [] };
    let topSellerItems = [];

    // Iterate through categories and fetch items for each category
    for (let category of categoriesRows) {
      const categoryId = category.id;
      const itemsQuery = "SELECT * FROM items WHERE category_id = ?";
      const [itemsRows] = await pool.query(itemsQuery, [categoryId]);

      if (itemsRows.length === 0) {
        // Handle no items in the category
        menuData[category.category] = {
          message: "No items found in this category",
        };
      } else {
        // Sort by order_count in descending order and get up to 10 items
        const topItems = itemsRows
          .sort((a, b) => b.order_count - a.order_count)
          .slice(0, 10);

        // Collect top seller items for all categories
        topSellerItems = [...topSellerItems, ...topItems].slice(0, 10);

        // Format items for the current category
        menuData[category.category] = topItems;
      }
    }

    // Add the top seller items to "TopSeller" after all categories are processed
    menuData.TopSeller = topSellerItems;

    res.status(200).json({
      status: "Success",
      data: {
        menuId: menuId,
        rating: restaurantDetails.rating,
        restaurantName: restaurantDetails.restaurant_name,
        ratingCount: restaurantDetails.rating_count,
        street: restaurantDetails.street,
        deliveryTime: deliveryTime, // Add delivery time to response
        categories: restaurantDetails.categories.slice(0, 2),
        menu: menuData,
      },
    });
  } catch (error) {
    console.error("Error fetching restaurant menu:", error);
    next(new AppError(500, "Internal server error"));
  }
});
