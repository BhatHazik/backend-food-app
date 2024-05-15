const db = require('../Config/database');

// CREATE Menu Item
exports.createMenuItem = async (req, res) => {
  try {
    const { meal_type, cuisine_type, description, restaurant_id } = req.body;
    const query = 'INSERT INTO menu (meal_type, cuisine_type, description, restaurant_id) VALUES (?, ?, ?, ?)';
    const values = [meal_type, cuisine_type, description, restaurant_id];
    const result = await db.query(query, values);
    const newMenuItem = {
      id: result.insertId,
      meal_type,
      cuisine_type,
      description,
      restaurant_id,
      created_at: new Date().toLocaleString(),
      updated_at: new Date().toLocaleString()
    };
    res.status(201).json({
      status: 'Success',
      data: newMenuItem,
      message: 'Menu item created successfully',
    });
  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(500).json({
      status: 'Error',
      message: 'Internal server error',
    });
  }
};

// READ All Menu Items
exports.getAllMenuItems = async (req, res) => {
  try {
    const query = 'SELECT * FROM menu';
    const [rows, fields] = await db.query(query);
    // Format dates in each menu item
    const menuItems = rows.map(item => ({
      ...item,
      created_at: new Date(item.created_at).toLocaleString(),
      updated_at: new Date(item.updated_at).toLocaleString()
    }));
    res.status(200).json({
      status: 'Success',
      data: menuItems,
    });
  } catch (error) {
    console.error('Error getting all menu items:', error);
    res.status(500).json({
      status: 'Error',
      message: 'Internal server error',
    });
  }
};

// READ Menu Item by ID
exports.getMenuItemById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'SELECT * FROM menu WHERE id = ?';
    const [rows, fields] = await db.query(query, [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({
        status: 'Error',
        message: `Menu item with id '${id}' not found`,
      });
    }
    // Format dates for the menu item
    const menuItem = {
      ...rows[0],
      created_at: new Date(rows[0].created_at).toLocaleString(),
      updated_at: new Date(rows[0].updated_at).toLocaleString()
    };
    res.status(200).json({
      status: 'Success',
      data: menuItem,
    });
  } catch (error) {
    console.error('Error getting menu item by ID:', error);
    res.status(500).json({
      status: 'Error',
      message: 'Internal server error',
    });
  }
};

// UPDATE Menu Item
exports.updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { meal_type, cuisine_type, description, restaurant_id } = req.body;
    const query = 'UPDATE menu SET meal_type = ?, cuisine_type = ?, description = ?, restaurant_id = ?, updated_at = ? WHERE id = ?';
    const values = [meal_type, cuisine_type, description, restaurant_id, new Date().toLocaleString(), id];
    const result = await db.query(query, values);
    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'Error',
        message: `Menu item with id '${id}' not found`,
      });
    }
    // Retrieve updated menu item data
    const updatedMenuItemQuery = 'SELECT * FROM menu WHERE id = ?';
    const [updatedRows, updatedFields] = await db.query(updatedMenuItemQuery, [id]);
    // Format dates for the updated menu item
    const updatedMenuItem = {
      ...updatedRows[0],
      created_at: new Date(updatedRows[0].created_at).toLocaleString(),
      updated_at: new Date(updatedRows[0].updated_at).toLocaleString()
    };
    res.status(200).json({
      status: 'Success',
      data: updatedMenuItem, // Include the updated data here
      message: `Menu item with id '${id}' updated successfully`,
    });
  } catch (error) {
    console.error('Error updating menu item:', error);
    res.status(500).json({
      status: 'Error',
      message: 'Internal server error',
    });
  }
};

// DELETE Menu Item
exports.deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'DELETE FROM menu WHERE id = ?';
    const result = await db.query(query, [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'Error',
        message: `Menu item with id '${id}' not found`,
      });
    }
    res.status(200).json({
      status: 'Success',
      message: `Menu item with id '${id}' deleted successfully`,
    });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({
      status: 'Error',
      message: 'Internal server error',
    });
  }
};
