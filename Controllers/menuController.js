const db = require('../Config/database');
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
// CREATE Menu Item
exports.createMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    // Insert menu item into the 'menus' table
    const insertQuery = 'INSERT INTO menus (name, restaurant_id) VALUES (?, ?)';
    const insertValues = [name, id];
    const result = await db.query(insertQuery, insertValues);
    
    // Check if the restaurant with the specified id is approved
    const checkQuery = `SELECT *
                        FROM restaurants
                        WHERE id = ?
                        AND approved = true`;
    const [rows] = await db.query(checkQuery, [id]);
    
    if (rows.length > 0) {
      res.status(201).json({
        status: 'Success',
        data: result,
        message: 'Menu item created successfully',
      });
    } else {
      res.status(403).json({
        status: 'Error',
        message: `Restaurant with id '${id}' is not approved or does not exist`,
      });
    }
  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(500).json({
      status: 'Error',
      message: 'Internal server error',
    });
  }
};


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






// READ Menu Item by ID
// exports.getMenuById = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const menuQuery = 'SELECT * FROM menus WHERE id = ?';
//     const [menuRows] = await db.query(menuQuery, [id]);
    
//     if (!menuRows || menuRows.length === 0) {
//       return res.status(404).json({
//         status: 'Error',
//         message: `Menus not found with id '${id}'`,
//       });
//     }
//     res.status(200).json({
//       status: 'Success',
//       menuRows
//     });

//   } catch (error) {
//     console.error('Error getting menu', error);
//     res.status(500).json({
//       status: 'Error',
//       message: 'Internal server error',
//     });
//   }
  
// };


// UPDATE Menu Item
// exports.updateMenuItem = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { meal_type, cuisine_type, description, restaurant_id } = req.body;
//     const query = 'UPDATE menu SET meal_type = ?, cuisine_type = ?, description = ?, restaurant_id = ?, updated_at = ? WHERE id = ?';
//     const values = [meal_type, cuisine_type, description, restaurant_id, new Date().toLocaleString(), id];
//     const result = await db.query(query, values);
//     if (result.affectedRows === 0) {
//       return res.status(404).json({
//         status: 'Error',
//         message: `Menu item with id '${id}' not found`,
//       });
//     }
//     // Retrieve updated menu item data
//     const updatedMenuItemQuery = 'SELECT * FROM menu WHERE id = ?';
//     const [updatedRows, updatedFields] = await db.query(updatedMenuItemQuery, [id]);
//     // Format dates for the updated menu item
//     const updatedMenuItem = {
//       ...updatedRows[0],
//       created_at: new Date(updatedRows[0].created_at).toLocaleString(),
//       updated_at: new Date(updatedRows[0].updated_at).toLocaleString()
//     };
//     res.status(200).json({
//       status: 'Success',
//       data: updatedMenuItem, // Include the updated data here
//       message: `Menu item with id '${id}' updated successfully`,
//     });
//   } catch (error) {
//     console.error('Error updating menu item:', error);
//     res.status(500).json({
//       status: 'Error',
//       message: 'Internal server error',
//     });
//   }
// };

// DELETE Menu Item
// exports.deleteMenuItem = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const query = 'DELETE FROM menu WHERE id = ?';
//     const result = await db.query(query, [id]);
//     if (result.affectedRows === 0) {
//       return res.status(404).json({
//         status: 'Error',
//         message: `Menu item with id '${id}' not found`,
//       });
//     }
//     res.status(200).json({
//       status: 'Success',
//       message: `Menu item with id '${id}' deleted successfully`,
//     });
//   } catch (error) {
//     console.error('Error deleting menu item:', error);
//     res.status(500).json({
//       status: 'Error',
//       message: 'Internal server error',
//     });
//   }
// };
