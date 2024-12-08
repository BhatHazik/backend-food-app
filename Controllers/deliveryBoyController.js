const {pool} = require('../Config/database');
const { asyncChoke } = require('../Utils/asyncWrapper');
const AppError = require("../Utils/error");
const { isValidPhoneNumber, createSendToken } = require('../Utils/utils');



exports.getDocumentStatus = asyncChoke(async (req, res, next) => {
  const user_id = req.user.id;

  try {
    // Single query to fetch all necessary data
    const [[data]] = await pool.query(`
      SELECT
        -- Delivery Boy Info
        db.first_name, db.last_name, db.profile_pic,
        -- Delivery Docs
        dd.adhar_front, dd.adhar_back, dd.pan_front, dd.pan_back, dd.dl_front, dd.dl_back,
        -- Delivery Vehicle Details
        dv.vehicle_no, dv.registration_no, dv.vehicle_type, dv.vehicle_image,
        -- Delivery Bank Details
        dbank.account_no, dbank.bank_name, dbank.IFSC_code,
        -- Delivery Work Type
        dw.type AS work_type
      FROM delivery_boys db
      LEFT JOIN delivery_docs dd ON db.id = dd.del_id
      LEFT JOIN delivery_vehicles dv ON db.id = dv.del_id
      LEFT JOIN delivery_bank dbank ON db.id = dbank.del_id
      LEFT JOIN delivery_work dw ON db.id = dw.del_id
      WHERE db.id = ?
    `, [user_id]);

    // If no data is found, return an error
    if (!data) {
      return next(new AppError(404, "Delivery boy not found!"));
    }

    // Initialize arrays for completed and pending documents
    const completed = [];
    const pending = [];

    // Helper function to check fields
    const checkFields = (fields, category) => {
      if (fields.every((field) => !!field)) {
        completed.push(category);
      } else {
        pending.push(category);
      }
    };

    // Check delivery boy personal information
    checkFields([data.first_name, data.last_name, data.profile_pic], "Personal Information");

    // Check delivery documents
    checkFields(
      [data.adhar_front, data.adhar_back, data.pan_front, data.pan_back, data.dl_front, data.dl_back],
      "Delivery Documents"
    );

    // Check delivery vehicle details
    checkFields(
      [data.vehicle_no, data.registration_no, data.vehicle_type, data.vehicle_image],
      "Vehicle Details"
    );

    // Check delivery bank details
    checkFields(
      [data.account_no, data.bank_name, data.IFSC_code],
      "Bank Details"
    );

    // Check delivery work type
    checkFields([data.work_type], "Work Type");

    // Return the document statuses
    return res.status(200).json({
      status: "success",
      data: {
        completedDocuments: completed,
        pendingDocuments: pending,
      },
    });
  } catch (error) {
    console.error(error);
    return next(new AppError(500, "Internal Server Error", error));
  }
});



exports.updateDeliveryBank = asyncChoke(async(req, res, next)=>{
  const user_id = req.user.id;
  const { account_no, bank_name, IFSC_code } = req.body;

  try{

  if(!account_no || !bank_name || !IFSC_code) {
    return next(new AppError(400, "Please provide all fields"));
  }
 
    const [updateBank] = await pool.query(`UPDATE delivery_bank SET account_no = ?, bank_name = ?, IFSC_code = ? WHERE del_id = ?`, [account_no, bank_name, IFSC_code, user_id])
    if(updateBank.affectedRows === 0){
      return next(new AppError(404, "Unable to load you bank details"));
    }
    res.status(200).json({
      status: "success",
      message: "Bank details updated successfully"
    });
  }catch(error){
    console.log(error)
    return next(new AppError(500, "Internal Server Error", error));
  }
})

exports.updateDeliveryVehicle = asyncChoke(async(req, res, next)=>{
  const user_id = req.user.id;
  const { vehicle_no, registration_no, vehicle_type, vehicle_image } = req.body;
  try{

  if(!vehicle_no ||!registration_no ||!vehicle_type ||!vehicle_image) {
    return next(new AppError(400, "Please provide all fields"));
  }
  
    const [updateVehicle] = await pool.query(`UPDATE delivery_vehicles SET vehicle_no =?, registration_no =?, vehicle_type =?, vehicle_image =? WHERE del_id =?`,[vehicle_no, registration_no, vehicle_type, vehicle_image, user_id])
    if(updateVehicle.affectedRows === 0){
      return next(new AppError(404, "Unable to load you vehicle details"));
    }
    res.status(200).json({
      status: "success",
      message: "Vehicle details updated successfully"
    });
  }
  catch(error){
    console.log(error)
    return next(new AppError(500, "Internal Server Error", error));
  }
});

exports.updateDeliveryPersonal = asyncChoke(async(req, res, next)=>{
 
  const user_id = req.user.id;
  const { first_name, last_name, gender, profile_pic} = req.body;

  try{

  if(!first_name || !last_name || !gender || !profile_pic) {
    return next(new AppError(400, "Please provide all fields"));
  }
  
    const [updatePersonal] = await pool.query(`UPDATE delivery_boys SET first_name = ?, last_name = ?, gender = ?, profile_pic = ? WHERE id =?`,[first_name, last_name, gender, profile_pic, user_id]);
    if(updatePersonal.affectedRows === 0){
      return next(new AppError(404, "Unable to load you personal details"));
    }
    res.status(200).json({
      status: "success",
      message: "Personal details updated successfully"
    });
  }
  catch(error){
    console.log(error)
    return next(new AppError(500, "Internal Server Error", error));
  }
});

exports.updateDeliveryDocs = asyncChoke(async(req, res, next)=>{
  
  const user_id = req.user.id;
  const { adhar_front, adhar_back, pan_front, pan_back, dl_front, dl_back } = req.body;

  try{

  if(!adhar_front || !adhar_back || !pan_front || !pan_back || !dl_front || !dl_back) {
    return next(new AppError(400, "Please provide all fields"));
  }
 
    const [updateDocs] = await pool.query(`UPDATE delivery_docs SET adhar_front = ?, adhar_back = ?, pan_front = ?, pan_back = ?, dl_front = ?, dl_back = ? WHERE del_id = ?`,[adhar_front, adhar_back, pan_front, pan_back, dl_front, dl_back, user_id])
    if(updateDocs.affectedRows === 0){
      return next(new AppError(404, "Unable to load you documents"));
    }
    res.status(200).json({
      status: "success",
      message: "Documents updated successfully"
    });
  }
  catch(error){
    console.log(error)
    return next(new AppError(500, "Internal Server Error", error));
  }
});

exports.updateWorkType = asyncChoke(async(req, res, next)=>{
  
  const user_id = req.user.id;
  const { type } = req.body;

  try{

  if(!type) {
    return next(new AppError(400, "Please provide type"));
  }
  
    const [updateWorkType] = await pool.query(`UPDATE delivery_work SET type = ? WHERE del_id = ?`,[type, user_id])
    if(updateWorkType.affectedRows === 0){
      return next(new AppError(404, "Unable to load you work type"));
    }
  }
  catch(error){
    console.log(error)
    return next(new AppError(500, "Internal Server Error", error));
  }
});



exports.sendApprovalRequest = asyncChoke(async (req, res, next) => {
  const user_id = req.user.id;

  // Query to check if all details are updated
  const [getDocsStatus] = await pool.query(`
    SELECT 
      d.first_name, d.last_name, d.gender, d.approved,
      db.account_no, db.bank_name, db.IFSC_code,
      dv.vehicle_no, dv.registration_no, dv.vehicle_type, dv.vehicle_image,
      dd.adhar_front, dd.adhar_back, dd.pan_front, dd.pan_back, dd.dl_front, dd.dl_back
    FROM delivery_boys d
    LEFT JOIN delivery_bank db ON d.id = db.del_id
    LEFT JOIN delivery_vehicles dv ON d.id = dv.del_id
    LEFT JOIN delivery_docs dd ON d.id = dd.del_id
    WHERE d.id = ?;
  `, [user_id]);
  if(getDocsStatus[0].approved === 'pending'){
    return next(new AppError(400, "Request is already in a pending approval check"));
  }
  if(getDocsStatus[0].approved === 'approved'){
    return next(new AppError(400, "Request is already approved"));
  }

  // If no data is found for the user
  if (getDocsStatus.length === 0) {
    return next(new AppError(404, "Delivery boy details are pending"));
  }

  const details = getDocsStatus[0];

  // Check if all required fields are filled
  if (
    !details.first_name ||
    !details.last_name ||
    !details.gender ||
    !details.account_no ||
    !details.bank_name ||
    !details.IFSC_code ||
    !details.vehicle_no ||
    !details.registration_no ||
    !details.vehicle_type ||
    !details.vehicle_image ||
    !details.adhar_front ||
    !details.adhar_back ||
    !details.pan_front ||
    !details.pan_back ||
    !details.dl_front ||
    !details.dl_back
  ) {
    return next(new AppError(400, "All required details are not updated"));
  }

  // If all fields are valid, update the delivery_boys table
  const [updateApproval] = await pool.query(
    `UPDATE delivery_boys SET approved = 'pending' WHERE id = ?`,
    [user_id]
  );

  if (updateApproval.affectedRows === 1) {
    return res.status(200).json({ message: "Approval request sent successfully" });
  } else {
    return next(new AppError(500, "Failed to update approval status"));
  }
});


exports.deliveryOTPsender = asyncChoke(async (req, res, next) => {
 
  const generateOTP = () => {
    return Math.floor(1000 + Math.random() * 9000);
  };

  const otp = generateOTP();
  let { phone_no } = req.body;
  console.log(phone_no)
  phone_no = String(phone_no).trim();
  

 
  if (!phone_no) {
    return next(new AppError(400, "Fill all fieldss"));
  }

 
  if(!isValidPhoneNumber(phone_no)){
    return next(new AppError(400, "Please Provide 10 digits mobile number"));
  }
  const [checkQuery] = await pool.query(
    `SELECT * FROM otps WHERE phone_no = ?`,
    [phone_no]
  );

  if (checkQuery.length === 1) {
    // Update OTP in the database for the provided phone number
    const query = `UPDATE otps SET otp = ? WHERE phone_no = ?`;
    const [result, fields] = await pool.query(query, [otp, phone_no]);
    // if(result.affectedRows === 1){
    //   console.log(result.affectedRows, "updated")
    // }
    return res.status(200).json({ message: "OTP sent successfully", otp });
  }
  const [insertQuery] = await pool.query(
    `INSERT INTO otps (phone_no, otp) VALUES (?,?)`,
    [phone_no, otp]
  );
  if(insertQuery.affectedRows === 1){
    console.log(insertQuery.affectedRows, "inserted")
  }
  return res
    .status(200)
    .json({ message: "OTP sent successfully", otp, phone_no });
});



exports.deliveryLogin = asyncChoke(async (req, res, next) => {
  const { givenOTP } = req.body;
  const phone_no = req.params.phNO;
  const role = "delivery_boy";

  // Check if givenOTP and phone_no are provided
  if (!givenOTP) {
    return next(new AppError(400, "OTP cannot be empty"));
  }
  if (!phone_no) {
    return next(new AppError(400, "Phone number cannot be empty"));
  }
  if (!isValidPhoneNumber(phone_no)) {
    return next(new AppError(400, "Please provide a 10-digit mobile number"));
  }

  const [checkQuery] = await pool.query(
    `SELECT * FROM delivery_boys WHERE phone_no = ?`,
    [phone_no]
  );

  if (checkQuery.length > 0) {
    // Check if the provided OTP matches the OTP stored for the phone number
    const otpQuery = `
      SELECT COUNT(*) AS otp_matched
      FROM otps
      WHERE phone_no = ?
        AND otp = ?;
    `;
    const [otpResult] = await pool.query(otpQuery, [phone_no, givenOTP]);

    if (otpResult[0].otp_matched === 1) {
      const token = createSendToken(res, req, phone_no, role);
      return res.status(200).json({ message: "Login success", token });
    } else {
      return next(new AppError(401, "Invalid OTP"));
    }
  } else {
    // OTP validation for a new user
    const otpQuery = `
      SELECT COUNT(*) AS otp_matched
      FROM otps
      WHERE phone_no = ?
        AND otp = ?;
    `;
    const [otpResult] = await pool.query(otpQuery, [phone_no, givenOTP]);

    if (otpResult[0].otp_matched === 1) {
      // Insert into delivery_boys
      const [deliverySignUp] = await pool.query(
        `INSERT INTO delivery_boys (phone_no) VALUES (?);`,
        [phone_no]
      );

      if (deliverySignUp.affectedRows === 1) {
        const del_id = deliverySignUp.insertId; // Retrieve the inserted delivery_boy ID

        // Insert into associated tables with the new del_id
        const queries = [
          pool.query(
            `INSERT INTO delivery_docs (del_id) VALUES (?);`,
            [del_id]
          ),
          pool.query(
            `INSERT INTO delivery_vehicles (del_id) VALUES (?);`,
            [del_id]
          ),
          pool.query(
            `INSERT INTO delivery_bank (del_id) VALUES (?);`,
            [del_id]
          ),
          pool.query(
            `INSERT INTO delivery_work (del_id) VALUES (?);`,
            [del_id]
          ),
        ];

        // Execute all queries in parallel
        await Promise.all(queries);
        
        // Generate token and respond
        const token = createSendToken(res, req, phone_no, role);
        return res
          .status(200)
          .json({ message: "Account created successfully", token });
      } else {
        return next(new AppError(401, "Sign-up Error"));
      }
    } else {
      return next(new AppError(401, "Invalid OTP"));
    }
  }
});




// exports.acceptOrder = asyncChoke(async(req, res, next)=>{
//   const {order_id} = req.query;
//   const {id:delivery_boy_id} = req.user;
//   try{
//     const [order] = await pool.query(`SELECT * FROM `)
//   }
// })


exports.goOnline = asyncChoke(async(req, res, next)=>{
  const {id:del_id} = req.user;
  const {status} = req.body;
  try{
    if(status !== 'online' && status !== 'offline'){
      return next(new AppError(400, 'Invalid status. Only online or offline is allowed'))
    }
    const [updateStatus] = await pool.query(
      `UPDATE delivery_work SET status = ? WHERE del_id = ?;`,
      [status, del_id]
    );
    if(updateStatus.affectedRows === 1){
      return res.status(200).json({message: 'Status updated successfully'})
    }else{
      return next(new AppError(500, 'Failed to update status'))
    }
  }
  catch(err){
    return next(new AppError(500, 'Server Error', err))
  }
})

















































exports.createDeleveryBoy = async (req, res) => {
    try {
      const { name, phone_number, vehicle_number, availability_status, aadhaar_card, pan_card,  } = req.body;
  
      // Check if any required field is missing
      if (!name || !phone_number || !vehicle_number || !availability_status || !aadhaar_card || !pan_card) {
        throw new AppError(400, 'All fields are required');
      }
  
      const query = 'INSERT INTO deliveryboys (name, phone_number, vehicle_number, availability_status, aadhaar_card, pan_card ) VALUES (?, ?, ?, ?, ?, ?)';
      const values = [name, phone_number, vehicle_number, availability_status, aadhaar_card, pan_card ];
      const result = await pool.query(query, values);
  
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
      const result = await pool.query(query, value);
  
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
      const result = await pool.query(query, [deliveryBoyId, true]);
  
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
      const checkResult = await pool.query(checkQuery, [deliveryBoyId, true]);
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
      const result = await pool.query(updateQuery, values);
  
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
      const result = await pool.query(query, [deliveryBoyId]);
  
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
exports.deliveryBoyOTPsender = async (req, res, next) => {
  try {
      const generateOTP = () => {
          return Math.floor(1000 + Math.random() * 9000);
      };

      const otp = generateOTP();
      const { phone_no } = req.body;

      // Check if phone_no is provided
      if (!phone_no) {
          return next(new AppError(401, "Fill all fields"));
      }

      // Update OTP in the database for the provided phone number
      const query = `UPDATE otps SET otp = ? WHERE phone_no = ?`;
      const [result, fields] = await pool.query(query, [otp, phone_no]);

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
      const [result, fields] = await pool.query(query, [phone_no, givenOTP]);

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