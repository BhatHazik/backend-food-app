const db = require('../Config/database');
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");


// READ All Menus by restaurant id


exports.getMenuById = asyncChoke(async (req, res, next) => {
  const { id ,latitude, longitude } = req.params;
  

  if (!latitude || !longitude) {
    return next(new AppError(400, 'User latitude and longitude must be provided'));
  }

  const radius = 5; // Radius in kilometers

  // Haversine formula to calculate distance
  const haversine = `(6371 * acos(cos(radians(${latitude})) * cos(radians(restaurantaddress.latitude)) * cos(radians(restaurantaddress.longitude) - radians(${longitude})) + sin(radians(${latitude})) * sin(radians(restaurantaddress.latitude))))`;

  // Query to check if the restaurant is within the radius
  const radiusQuery = `
    SELECT COUNT(*) AS count
    FROM restaurants
    INNER JOIN restaurantaddress ON restaurants.id = restaurantaddress.restaurant_id
    WHERE restaurants.id = ? AND approved = ? AND ${haversine} <= ? 
  `;

  try {
    // Execute the query to check if the restaurant is within the radius
    const [radiusRows, _] = await db.query(radiusQuery, [id, true, radius]);

    // Check if restaurant is not found or not within the radius
    if (radiusRows.length === 0 || radiusRows[0].count === 0) {
      return next(new AppError(404, 'Restaurant not found!'));
    }

    // Proceed with fetching menu and items as before
    const menuIdQuery = 'SELECT id FROM menus WHERE restaurant_id = ?';
    const [menuRows] = await db.query(menuIdQuery, [id]);

    if (menuRows.length === 0) {
      return next(new AppError(404, 'Menu not found for this restaurant'));
    }

    const menuId = menuRows[0].id;
    const categoriesQuery = 'SELECT * FROM categories WHERE menu_id = ?';
    const [categoriesRows] = await db.query(categoriesQuery, [menuId]);

    const menuData = {};

    // Iterate through categories and fetch items for each category
    for (let category of categoriesRows) {
      const categoryId = category.id;
      const itemsQuery = 'SELECT * FROM items WHERE category_id = ?';
      const [itemsRows] = await db.query(itemsQuery, [categoryId]);

      // Check if items are not found for the category
      if (itemsRows.length === 0) {
        menuData[category.category] = []; // Assign an empty array for no items found
      } else {
        // Format items for the current category
        const formattedItems = itemsRows.map(item => item);
        menuData[category.category] = formattedItems;
      }
    }

    res.status(200).json({
      status: 'Success',
      data: {
        menuId: menuId,
        menu: menuData,
      },
    });
  } catch (error) {
    console.error('Error fetching restaurant menu:', error);
    next(new AppError(500, 'Internal server error'));
  }
});