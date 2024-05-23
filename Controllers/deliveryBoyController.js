const db = require('../Config/database');
const AppError = require("../Utils/error");



exports.createDeleveryBoy = async (req, res) => {
    try {
      const { name, phone_number, vehicle_number, availability_status, aadhaar_card, pan_card,  } = req.body;
  
      // Check if any required field is missing
      if (!name || !phone_number || !vehicle_number || !availability_status || !aadhaar_card || !pan_card) {
        throw new AppError(400, 'All fields are required');
      }
  
      const query = 'INSERT INTO deliveryboys (name, phone_number, vehicle_number, availability_status, aadhaar_card, pan_card ) VALUES (?, ?, ?, ?, ?, ?)';
      const values = [name, phone_number, vehicle_number, availability_status, aadhaar_card, pan_card ];
      const result = await db.query(query, values);
  
      const newDeliveryBoy = {
        id: result.insertId,
        name,
        phone_number,
        vehicle_number,
        availability_status,
        aadhaar_card,
        pan_card,
        created_at: new Date(),
        updated_at: new Date()
      };
  
      res.status(201).json({
        status: 'Success',
        data: newDeliveryBoy,
      });
    } catch (error) {console.error('Error creating deleveryGuy', error);
      res.status(error.statusCode || 500).json({
        status: 'Error',
        message: error.message || 'Internal server error',
      });
    }
  };



  exports.getAllApprovedDeliveryBoys = async (req, res) => {
    try {
      const query = 'SELECT * FROM deliveryboys WHERE approved = ?';
      const value = [true];
      const result = await db.query(query, value);
  
      // Check the structure of the result
     
  
      // Assuming result is an array of rows, if using mysql2 library
      const deliveryBoys = result.map(row => ({
        id: row.id,
        name: row.name,
        phone_number: row.phone_number,
        vehicle_number: row.vehicle_number,
        availability_status: row.availability_status,
        aadhaar_card: row.aadhaar_card,
        pan_card: row.pan_card,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
  
      if (deliveryBoys.length === 0) {
        return res.json({
          status: 'error',
          message: 'No delivery boys found!'
        });
      }
  
      res.json({
        status: 'success',
        data: deliveryBoys
      });
    } catch (error) {
      console.error('Error fetching approved delivery boys', error);
      res.status(error.statusCode || 500).json({
        status: 'error',
        message: error.message || 'Internal server error'
      });
    }
  };
  



exports.getApprovedDeliveryBoyById = async (req, res) => {
    try {
      const deliveryBoyId = req.params.id; // Assuming the ID is passed as a route parameter
      const query = 'SELECT * FROM deliveryboys WHERE id = ? AND approved = ?';
      const result = await db.query(query, [deliveryBoyId, true]);
  
      if (result.length[0] === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Approved delivery boy not found'
        });
      }
  
      res.json({
        status: 'success',
        data: result[0] // Assuming you expect only one result for a given ID
      });
    } catch (error) {
      console.error('Error fetching approved delivery boy by ID', error);
      res.status(error.statusCode || 500).json({
        status: 'error',
        message: error.message || 'Internal server error'
      });
    }
  };


  // deliveryBoyController.js

// deliveryBoyController.js

// deliveryBoyController.js

exports.updateApprovedDeliveryBoy = async (req, res) => {
    try {
      const deliveryBoyId = req.params.id;
      const { name, phone_number, availability_status } = req.body;
  
      // Check if the delivery boy with the given ID exists and is approved
      const checkQuery = 'SELECT * FROM deliveryboys WHERE id = ? AND approved = ?';
      const checkResult = await db.query(checkQuery, [deliveryBoyId, true]);
      if (checkResult.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Approved delivery boy not found or not approved'
        });
      }
  
      // If delivery boy is found and approved, proceed with the update
      const updateQuery = `
        UPDATE deliveryboys 
        SET name = ?, phone_number = ?, availability_status = ? 
        WHERE id = ? AND approved = true
      `;
      const values = [name, phone_number, availability_status, deliveryBoyId];
      const result = await db.query(updateQuery, values);
  
      if (result.affectedRows === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'No changes applied or delivery boy not found'
        });
      }
  
      res.json({
        status: 'success',
        message: 'Approved delivery boy updated successfully',
        result
      });
    } catch (error) {
      console.error('Error updating approved delivery boy', error);
      res.status(error.statusCode || 500).json({
        status: 'error',
        message: error.message || 'Internal server error'
      });
    }
  };
  


  // deliveryBoyController.js

exports.deleteApprovedDeliveryBoy = async (req, res) => {
    try {
      const deliveryBoyId = req.params.id;
  
      const query = 'DELETE FROM deliveryboys WHERE id = ? AND approved = true';
      const result = await db.query(query, [deliveryBoyId]);
  
      if (result.affectedRows === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Approved delivery boy not found or already deleted'
        });
      }
  
      res.json({
        status: 'success',
        message: 'Approved delivery boy deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting approved delivery boy', error);
      res.status(error.statusCode || 500).json({
        status: 'error',
        message: error.message || 'Internal server error'
      });
    }
  };
  
  
  


  // OTPSENDER
exports.deliveryBoyOTPsender = async (req, res) => {
  try {
      const generateOTP = () => {
          return Math.floor(1000 + Math.random() * 9000);
      };

      const otp = generateOTP();
      const { phone_no } = req.body;

      // Check if phone_no is provided
      if (!phone_no) {
          return res.status(400).json({ error: "Fill all fields" });
      }

      // Update OTP in the database for the provided phone number
      const query = `UPDATE otps SET otp = ? WHERE phone_no = ?`;
      const [result, fields] = await db.query(query, [otp, phone_no]);

      return res.status(200).json({ message: 'OTP sent successfully', result });
  } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Internal server error' });
  }
};


// OTP CHECKER (LOGIN)
exports.deliveryBoyLogin = async (req, res) => {
  try {
      const { givenOTP } = req.body;
      const phone_no = req.params.phNO;

      // Check if givenOTP is provided
      if (!givenOTP) {
          return res.status(400).json({ message: 'OTP cannot be empty' });
      }

      // Check if the provided OTP matches the OTP stored for the phone number
      const query = `
          SELECT COUNT(*) AS otp_matched
          FROM otps
          WHERE phone_no = ?
            AND otp = ?
      `;
      const [result, fields] = await db.query(query, [phone_no, givenOTP]);

      if (result[0].otp_matched === 1) {
          return res.status(200).json({ message: 'Login success', result });
      } else {
          return res.status(401).json({ message: 'Invalid OTP' });
      }
  } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Internal server error' });
  }
};