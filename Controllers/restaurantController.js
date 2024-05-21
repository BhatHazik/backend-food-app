const db = require('../Config/database');
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");

// CREATE Restaurant
exports.createRestaurant = async (req, res) => {
  try {
    const { owner_name, owner_phone_no, owner_email, restaurant_name, pan_no, GSTIN_no, FSSAI_no } = req.body;

    // Check if any required field is missing
    if (!owner_name || !owner_phone_no || !owner_email || !restaurant_name || !pan_no || !GSTIN_no || !FSSAI_no) {
      throw new AppError(400, 'All fields are required');
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
    res.status(error.statusCode || 500).json({
      status: 'Error',
      message: error.message || 'Internal server error',
    });
  }
};

// READ All Approved Restaurants
exports.getAllApprovedRestaurants = asyncChoke(async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const radius = 5; // Radius in kilometers

    // Haversine formula to calculate distance
    const haversine = `(6371 * acos(cos(radians(${latitude})) * cos(radians(restaurantAddress.latitude)) * cos(radians(restaurantAddress.longitude) - radians(${longitude})) + sin(radians(${latitude})) * sin(radians(restaurantAddress.latitude))))`;

    // Query to get restaurants within the radius of the user's location
    const query = `
      SELECT restaurants.*, restaurantAddress.latitude AS restaurant_latitude, restaurantAddress.longitude AS restaurant_longitude, ${haversine} AS distance
      FROM restaurants
      INNER JOIN restaurantAddress ON restaurants.id = restaurantAddress.restaurant_id
      WHERE restaurants.approved = true AND ${haversine} <= ?
    `;

    const [rows, fields] = await db.query(query, [radius]);

    res.status(200).json({
      status: 'Success',
      data: rows,
    });
  } catch (error) {
    console.error('Error fetching restaurants near user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// READ Restaurant by ID
exports.getRestaurantById = asyncChoke(async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'SELECT * FROM restaurants WHERE id = ?';
    const [rows, fields] = await db.query(query, [id]);
    
    if (!rows || rows.length === 0) {
      throw new AppError(404, `Restaurant with id '${id}' not found`);
    }
    
    res.status(200).json({
      status: 'Success',
      data: rows[0],
    });
  } catch (error) {
    console.error('Error getting restaurant by ID:', error);
    throw new AppError(error.statusCode || 500, error.message || 'Internal server error');
  }
});
                
// UPDATE Restaurant
exports.updateRestaurant = asyncChoke(async (req, res) => {
  try {
    const { id } = req.params;
    const { owner_name, owner_phone_no, owner_email, restaurant_name } = req.body;
    const query = 'UPDATE restaurants SET owner_name = ?, owner_phone_no = ?, owner_email = ?, restaurant_name = ?, updated_at = ? WHERE id = ?';
    const values = [ owner_name, owner_phone_no, owner_email, restaurant_name , new Date(), id];
    const result = await db.query(query, values);
    if (result.affectedRows === 0) {
      throw new AppError(404, `Restaurant with id '${id}' not found`);
    }
    res.status(200).json({
      status: 'Success',
      message: `Restaurant with id '${id}' updated successfully`,
    });
  } catch (error) {
    console.error('Error updating restaurant:', error);
    throw new AppError(error.statusCode || 500, error.message || 'Internal server error');
  }
});

// DELETE Restaurant
exports.deleteRestaurant = asyncChoke(async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'DELETE FROM restaurants WHERE id = ?';
    const result = await db.query(query, [id]);
    if (result.affectedRows === 0) {
      throw new AppError(404, `Restaurant with id '${id}' not found`);
    }
    res.status(200).json({
      status: 'Success',
      message: `Restaurant with id '${id}' deleted successfully`,
    });
  } catch (error) {
    console.error('Error deleting restaurant:', error);
    throw new AppError(error.statusCode || 500, error.message || 'Internal server error');
  }
});
