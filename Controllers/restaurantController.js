const db = require('../Config/database');

// CREATE Restaurant
exports.createRestaurant = async (req, res) => {
  try {
    const { owner_name, owner_phone_no, owner_email, restaurant_name, pan_no, GSTIN_no, FSSAI_no } = req.body;

    // Check if any required field is missing
    if (!owner_name || !owner_phone_no || !owner_email || !restaurant_name || !pan_no || !GSTIN_no || !FSSAI_no) {
      return res.status(400).json({
        status: 'Error',
        message: 'All fields are required',
      });
    }

    const query = 'INSERT INTO restaurants (owner_name, owner_phone_no, owner_email, restaurant_name, pan_no, GSTIN_no, FSSAI_no) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const values = [owner_name, owner_phone_no, owner_email, restaurant_name, pan_no, GSTIN_no, FSSAI_no];
    const result = await db.query(query, values);

    const newRestaurant = {
      id: result.insertId,
      owner_name,
      owner_phone_no,
      owner_email,
      restaurant_name,
      pan_no,
      GSTIN_no,
      FSSAI_no,
      created_at: new Date(),
      updated_at: new Date()
    };

    res.status(201).json({
      status: 'Success',
      data: newRestaurant,
    });
  } catch (error) {
    console.error('Error creating restaurant:', error);
    res.status(500).json({
      status: 'Error',
      message: 'Internal server error',
    });
  }
};


// READ All Restaurants
exports.getAllRestaurants = async (req, res) => {
  try {
    const query = 'SELECT * FROM restaurant ';
    const [rows, fields] = await db.query(query);
    res.status(200).json({
      status: 'Success',
      data: rows,
    });
  } catch (error) {
    console.error('Error getting all restaurants:', error);
    res.status(500).json({
      status: 'Error',
      message: 'Internal server error',
    });
  }
};

// READ Restaurant by ID
exports.getRestaurantById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'SELECT * FROM restaurant WHERE id = ?';
    const [rows, fields] = await db.query(query, [id]);
    
    if (!rows || rows.length === 0) {
      return res.status(404).json({
        status: 'Error',
        message: `Restaurant with id '${id}' not found`,
      });
    }
    
    res.status(200).json({
      status: 'Success',
      data: rows[0],
    });
  } catch (error) {
    console.error('Error getting restaurant by ID:', error);
    res.status(500).json({
      status: 'Error',
      message: 'Internal server error',
    });
  }
};

// UPDATE Restaurant
exports.updateRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const { owner_name, owner_phone_no, owner_email, restaurant_name } = req.body;
    const query = 'UPDATE restaurants SET owner_name = ?, owner_phone_no = ?, owner_email = ?, restaurant_name = ?, updated_at = ? WHERE id = ?';
    const values = [ owner_name, owner_phone_no, owner_email, restaurant_name , new Date(), id];
    const result = await db.query(query, values);
    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'Error',
        message: `Restaurant with id '${id}' not found`,
      });
    }
    res.status(200).json({
      status: 'Success',
      message: `Restaurant with id '${id}' updated successfully`,
    });
  } catch (error) {
    console.error('Error updating restaurant:', error);
    res.status(500).json({
      status: 'Error',
      message: 'Internal server error',
    });
  }
};

// DELETE Restaurant
exports.deleteRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'DELETE FROM restaurant WHERE id = ?';
    const result = await db.query(query, [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'Error',
        message: `Restaurant with id '${id}' not found`,
      });
    }
    res.status(200).json({
      status: 'Success',
      message: `Restaurant with id '${id}' deleted successfully`,
    });
  } catch (error) {
    console.error('Error deleting restaurant:', error);
    res.status(500).json({
      status: 'Error',
      message: 'Internal server error',
    });
  }
};
