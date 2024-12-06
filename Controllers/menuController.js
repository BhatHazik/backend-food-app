const { pool } = require("../Config/database");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");

// READ All Menus by restaurant id
exports.getMenuById = asyncChoke(async (req, res, next) => {
  const { id, latitude, longitude } = req.params;
  const { type } = req.query;

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

  restaurantDetails = {
    restaurant_name: restaurantCheck[0].restaurant_name,
    street: restaurantCheck[0].street,
    rating_count: restaurantCheck[0].rating_count,
    rating: restaurantCheck[0].rating,
    categories: restaurantCheck.map((row) => row.category),
    restaurant_latitude: restaurantCheck[0].restaurant_latitude,
    restaurant_longitude: restaurantCheck[0].restaurant_longitude,
  };

  const radius = 10; // Radius in kilometers
  const cookingPackingTime = 10; // Fixed 10 minutes for cooking and packing
  const averageSpeed = 0.5; // 30 km/h = 0.5 km/min
  const bufferTime = 5; // Buffer time in minutes for range

  const haversine = `(6371 * acos(cos(radians(${latitude})) * cos(radians(${restaurantDetails.restaurant_latitude})) * cos(radians(${restaurantDetails.restaurant_longitude}) - radians(${longitude})) + sin(radians(${latitude})) * sin(radians(${restaurantDetails.restaurant_latitude}))))`;

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
    const [radiusRows] = await pool.query(radiusQuery, [id, true, radius]);

    if (radiusRows.length === 0 || radiusRows[0].count === 0) {
      return next(new AppError(404, "Restaurant not found or out of delivery range!"));
    }

    const distance = radiusRows[0].distance;
    const travelTime = distance / averageSpeed; // in minutes
    const minTime = travelTime - bufferTime + cookingPackingTime; // Minimum time
    const maxTime = travelTime + bufferTime + cookingPackingTime; // Maximum time
    const deliveryTime = `${Math.max(0, Math.floor(minTime))} - ${Math.ceil(maxTime)} min`;

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

      // Filter items by type (veg or non-veg) if 'type' query parameter is provided
      const itemsQuery = type
        ? "SELECT * FROM items WHERE category_id = ? AND type = ?"
        : "SELECT * FROM items WHERE category_id = ?";

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
        menuData[category.category] = topItems;
      }
    }

    menuData.TopSeller = topSellerItems;

    res.status(200).json({
      status: "Success",
      data: {
        menuId: menuId,
        rating: restaurantDetails.rating,
        restaurantName: restaurantDetails.restaurant_name,
        ratingCount: restaurantDetails.rating_count,
        street: restaurantDetails.street,
        deliveryTime: deliveryTime,
        categories: restaurantDetails.categories.slice(0, 2),
        menu: menuData,
      },
    });
  } catch (error) {
    console.error("Error fetching restaurant menu:", error);
    next(new AppError(500, "Internal server error"));
  }
});




exports.searchItemsInRestaurant = asyncChoke(async (req, res, next) => {
  const { id } = req.params; // Restaurant ID
  const { search } = req.query;

  // Validate Restaurant ID
  if (!id) {
    return next(new AppError(400, "Restaurant ID is required!"));
  }

  // If search is empty or too short, return an empty array
  if (!search || search.trim().length < 2) {
    return res.status(200).json({
      status: "Success",
      data: [],
    });
  }

  const searchQuery = `%${search}%`;

  // SQL query with Full-Text Search and fallback to LIKE/SOUNDEX
  const itemsQuery = `
    SELECT 
      items.id AS item_id,
      items.name AS item_name,
      items.price,
      items.description,
      items.type,
      items.order_count,
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
    // Execute the query with parameterized inputs
    const [items] = await pool.query(itemsQuery, [
      id,
      search,
      search,
      searchQuery,
      search,
    ]);

    // If no items are found, return an empty response
    if (items.length === 0) {
      return res.status(200).json({
        status: "Success",
        data: [],
      });
    }

    // Transform the result data
    const formattedItems = items.map((item) => ({
      item_id: item.item_id,
      name: item.item_name,
      price: parseFloat(item.price).toFixed(2), // Ensure consistent decimal formatting
      description: item.description || "No description available",
      type: item.type,
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






