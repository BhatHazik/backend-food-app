const db = require('../Config/database');
const { asyncChoke } = require('../Utils/asyncWrapper');
const AppError = require('../Utils/error');

// Controller function to create a new offer
exports.createOffer = asyncChoke(async (req, res, next) => {
  const { title, description, discount_type, discount_value, minimum_order_amount, maximum_discount_amount, code, terms_and_conditions, expiring_at } = req.body;

  try {
      // Insert offer into database
      const [result] = await db.query(
          `INSERT INTO offers (title, description, discount_type, discount_value, minimum_order_amount, maximum_discount_amount, code, terms_and_conditions, expiring_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [title, description, discount_type, discount_value, minimum_order_amount, maximum_discount_amount, code, terms_and_conditions, expiring_at]
      );

      if (result.affectedRows === 1) {
          res.status(201).json({
              status: 'success',
              message: 'Offer created successfully',
              data: {
                  offer_id: result.insertId
              }
          });
      } else {
          return next(new AppError(500, 'Failed to create offer'));
      }
  } catch (error) {
      return next(new AppError(500, error.message || 'Internal server error'));
  }
});


exports.acceptOfferSeller = asyncChoke(async (req, res, next) => {
  const restaurant_id = req.user.id;  // Assuming req.user.id contains restaurant_id
  const { offer_id } = req.params;
  console.log(restaurant_id)
  try {
      // Check if the offer_id exists in the offers table
      const [offer] = await db.query(`SELECT * FROM offers WHERE id = ?`, [offer_id]);
      if (offer.length === 0) {
          return next(new AppError(404, 'Offer not found'));
      }
      const acceptedOfferQuery = `SELECT * FROM accepted_offer_seller WHERE restaurant_id = ? AND offer_id = ?`
      const acceptedofferValue = [restaurant_id , offer_id]
      const [alreadyAccepted] = await db.query(acceptedOfferQuery,acceptedofferValue);
      if(alreadyAccepted.length === 1){
        return next(new AppError(409, "Offer already accepted by this restaurant!"));
      }
      // Insert into accepted_offer_seller table
      const [result] = await db.query(
          `INSERT INTO accepted_offer_seller (offer_id, restaurant_id) VALUES (?, ?)`,
          [offer_id, restaurant_id]
      );

      if (result.affectedRows === 1) {
          res.status(201).json({
              status: 'success',
              message: 'Offer accepted successfully'
          });
      } else {
          return next(new AppError(500, 'Failed to accept offer'));
      }
  } catch (error) {
      return next(new AppError(500, error.message || 'Internal server error'));
  }
});

exports.getOffersFromRestaurants = asyncChoke(async (req, res, next) => {
  const { restaurant_id } = req.params;

  try {
      // Fetch all offers accepted by the specified restaurant
      const query = `
          SELECT o.*
          FROM offers o
          JOIN accepted_offer_seller aos ON o.id = aos.offer_id
          WHERE aos.restaurant_id = ?
      `;
      const [rows] = await db.query(query, [restaurant_id]);

      if (rows.length === 0) {
          return next(new AppError(404, 'No offers found for the given restaurant'));
      }

      res.status(200).json({
          status: 'success',
          data: rows
      });
  } catch (error) {
      return next(new AppError(500, error.message || 'Internal server error'));
  }
});



// Controller function to get all offers
exports.getOffers = async (req, res) => {
    try {
      // Fetch all offers from the database
      const query = `
        SELECT * FROM offers
      `;
  
      const [rows] = await db.execute(query);
  
      res.status(200).json({
        status: 'Success',
        data: rows,
      });
    } catch (error) {
      console.error('Error fetching offers:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  

  // Controller function to get an offer by ID
  exports.getOfferById = async (req, res) => {
    try {
      const { offer_id } = req.params;
      const query = 'SELECT * FROM offers WHERE id = ?';
      const [offers] = await db.execute(query, [offer_id]);
  
      if (offers.length === 0) {
        return res.status(404).json({ error: 'Offer not found' });
      }
  
      res.status(200).json({
        status: 'Success',
        data: offers[0],
      });
    } catch (error) {
      console.error('Error fetching offer:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  

  

  // Controller function to update an existing offer
  exports.updateOfferById = async (req, res) => {
    try {
      const { offer_id } = req.params;
      const {
        offer_name,
        offer_description,
        validity_start,
        validity_end,
        terms_and_conditions,
        discount_percentage,
        discount_condition,
        discount_on,
        status
      } = req.body;
  
      // Validate the inputs
      if (!offer_name || !offer_description || !validity_start || !validity_end || discount_percentage === undefined || !discount_condition || discount_on === undefined || !status) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
  
      // Log the received offer ID
    //   console.log(`Received offer_id: ${offer_id}`);
  
      // Check if the offer exists
      const checkQuery = 'SELECT * FROM offers WHERE id = ?';
      const [offers] = await db.execute(checkQuery, [offer_id]);
  
      if (offers.length === 0) {
        console.log(`Offer with id ${offer_id} not found`);
        return res.status(404).json({ error: 'Offer not found' });
      }
  
      // Log the existing offer details
    //   console.log(`Existing offer details: ${JSON.stringify(offers[0])}`);
  
      // Format dates to 'YYYY-MM-DD HH:MM:SS'
      const formatDate = (date) => {
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      };
  
      const formattedValidityStart = formatDate(validity_start);
      const formattedValidityEnd = formatDate(validity_end);
  
      const query = `
        UPDATE offers
        SET offer_name = ?, offer_description = ?, validity_start = ?, validity_end = ?, terms_and_conditions = ?, discount_percentage = ?, discount_condition = ?, discount_on = ?, updated_at = ?, status = ?
        WHERE id = ?
      `;
  
      const [result] = await db.execute(query, [
        offer_name,
        offer_description,
        formattedValidityStart,
        formattedValidityEnd,
        terms_and_conditions,
        discount_percentage,
        discount_condition,
        discount_on,
        new Date(),
        status,
        offer_id
      ]);
  
      if (result.affectedRows === 0) {
        console.log(`No rows affected for offer_id ${offer_id}`);
        return res.status(404).json({ error: 'Offer not found' });
      }
  
      res.status(200).json({
        status: 'Success',
        data: {
          id: offer_id,
          offer_name,
          offer_description,
          validity_start: formattedValidityStart,
          validity_end: formattedValidityEnd,
          terms_and_conditions,
          discount_percentage,
          discount_condition,
          discount_on,
          updated_at: new Date(),
          status
        },
      });
    } catch (error) {
      console.error('Error updating offer:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  
  

  

  // Controller function to delete an offer by ID
  exports.deleteOfferById = async (req, res) => {
    try {
      const { offer_id } = req.params;
      const query = 'DELETE FROM offers WHERE id = ?';
      const [result] = await db.execute(query, [offer_id]);
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Offer not found' });
      }
  
      res.status(200).json({ status: 'Success', message: 'Offer deleted successfully' });
    } catch (error) {
      console.error('Error deleting offer:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  