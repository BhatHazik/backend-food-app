const { pool } = require("../Config/database");
const jwt = require("jsonwebtoken");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
const { isValidPhoneNumber, convertExpiryDate } = require("../Utils/utils");
const { verifyPaymentOrder } = require("../Utils/razorpay");

// create or signup with otp

// create otp on number
// createUserOTP API
exports.createUserOTP = asyncChoke(async (req, res, next) => {
  const generateOTP = () => Math.floor(1000 + Math.random() * 9000);
  const otp = generateOTP();
  const { username, email, phone_no } = req.body;
  // console.log(process.env.DATABASE_NAME,process.env.DATABASE_HOST)

  if (username !== "" && email !== "" && phone_no !== "") {
    if(!isValidPhoneNumber(phone_no)){
      return next(new AppError(400, "Please Provide 10 digits mobile number"));
    }
    const checkQuery = `SELECT * FROM users WHERE phone_no = ?`;
    const [checkResult] = await pool.query(checkQuery, [phone_no]);
    if (checkResult.length > 0) {
      return next(new AppError(400, "Phone number already exists"));
    } else {
      const otpPhoneExist = `SELECT * FROM otps WHERE phone_no = ?`;
      const [checkOtpPhone] = await pool.query(otpPhoneExist, [phone_no]);
      if (checkOtpPhone.length > 0) {
        const updateOtpQuery = `UPDATE otps SET otp = ? WHERE phone_no = ?`;
        await pool.query(updateOtpQuery, [otp, phone_no]);
      } else {
        const insertQuery = `INSERT INTO otps (phone_no, otp) VALUES (?, ?);`;
        await pool.query(insertQuery, [phone_no, otp]);
      }
      return res
        .status(200)
        .json({
          message: "otp sent successfully",
          data: { username, email, phone_no, otp },
        });
    }
  } else {
    return next(new AppError(400, "fill all feilds"));
  }
});

const createSendToken = (res, req, phone_no) => {
  const tokenOptions = { expiresIn: process.env.JWT_EXPIRY };
  // console.log(process.env.JWT_EXPIRY, process.env.JWT_SECRET)
  const token = jwt.sign(
    { data: phone_no },
    process.env.JWT_SECRET,
    tokenOptions
  );
  return token;
};
// userSignUp API
exports.userSignUp = asyncChoke(async (req, res, next) => {
  const { givenOTP } = req.body;
  const { name, email, phNO: phone_no } = req.params;

  if (givenOTP !== "" && phone_no !== "" && email !== "" && name !== "") {
    if(!isValidPhoneNumber(phone_no)){
      return next(new AppError(400, "Please Provide 10 digits mobile number"));
    }
    const checkUserQuery = `SELECT COUNT(*) AS phone_exist FROM users WHERE phone_no = ?`;
    const [userResult] = await pool.query(checkUserQuery, [phone_no]);

    if (userResult[0].phone_exist > 0) {
      return next(new AppError(401, "User Already Exist"));
    }

    const checkOTPQuery = `SELECT COUNT(*) AS otp_matched FROM otps WHERE phone_no = ? AND otp = ?`;
    const [otpResult] = await pool.query(checkOTPQuery, [phone_no, givenOTP]);

    if (otpResult[0].otp_matched === 0) {
      return next(new AppError(401, "Invalid OTP"));
    }
    const token = createSendToken(res, req, phone_no);
    const insertUserQuery = `INSERT INTO users (username, email, phone_no) VALUES (?, ?, ?)`;
    await pool.query(insertUserQuery, [name, email, phone_no]);
    const userDataQuery = `SELECT * FROM users WHERE phone_no = ?`;
    const userValue = [phone_no];
    const [result] = await pool.query(userDataQuery, userValue);
    const cartQuery = `INSERT INTO cart (user_id) VALUES(?)`;
    const value = [result[0].id];
    await pool.query(cartQuery, value);
    console.log("ok");
    return res.status(200).json({status:"Success", userData:result[0], message: "Account created successfully", token});
  } else {
    return next(new AppError(400, "Fill all fields"));
  }
});

exports.userLogin = asyncChoke(async (req, res, next) => {
  const { givenOTP } = req.body;
  const { phone_no } = req.params;

  if (givenOTP !== "" && phone_no !== "") {
    if(!isValidPhoneNumber(phone_no)){
      return next(new AppError(400, "Please Provide 10 digits mobile number"));
    }
    // console.log(givenOTP)
    const checkUserQuery = `SELECT * FROM users WHERE phone_no = ?`;
    const [userResult] = await pool.query(checkUserQuery, [phone_no]);
// console.log(userResult[0]);
    if (userResult.length > 0) {
      // return next(new AppError(409, 'user already exists'));
      const checkOTPQuery = `SELECT COUNT(*) AS otp_matched FROM otps WHERE phone_no = ? AND otp = ?`;
      const [otpResult] = await pool.query(checkOTPQuery, [phone_no, givenOTP]);

      if (otpResult[0].otp_matched === 0) {
        return next(new AppError(401, "Invalid OTP"));
      }
      const token = createSendToken(res, req, phone_no);
      return res.status(200).json({status:"Success", message: "Logged in successfully",userData:userResult[0], token });
    }
    else{
      return next(new AppError(404, "User not found"));
    }
  } else {
    return next(new AppError(400, "Fill all fields"));
  }
});

// read

exports.readUsers = async (req, res) => {
  const query = `SELECT * FROM users`;
  const [result, fields] = await pool.query(query);
  res.status(200).json({ result });
};

// update

exports.updateUser = asyncChoke(async (req, res, next) => {
  const { newUsername, oldUsername, phone_no } = req.body;

  // Check if all required fields are provided
  if (!newUsername || !oldUsername || !phone_no) {
    return next(new AppError(400, "Fill all fields"));
  }

  // Proceed with the update if all fields are provided
  const query = `UPDATE users SET username = ?, phone_no = ? WHERE username = ? AND phone_no = ?`;
  const [result, fields] = await pool.query(query, [
    newUsername,
    phone_no,
    oldUsername,
    phone_no,
  ]);

  return res.status(200).json({ result });
});

// delete

exports.deleteUser = asyncChoke(async (req, res, next) => {
  const id = req.user.id;

  const query = `UPDATE users SET status = ? WHERE id = ?`;
  const [result] = await pool.query(query, ["inactive", id]);

  if (result.affectedRows === 0) {
    return next(new AppError(401, "Cannot delete account!"));
  }
  return res.status(200).json({
    status: "User account has been deleted!",
  });
});

// OTPSENDER
exports.userOTPsender = asyncChoke(async (req, res, next) => {
  const generateOTP = () => {
    return Math.floor(1000 + Math.random() * 9000);
  };

  const otp = generateOTP();
  const { phone_no } = req.body;
  // Check if phone_no is provided
  if (!phone_no) {
    return next(new AppError(400, "Fill all fields"));
  }
  if(!isValidPhoneNumber(phone_no)){
    return next(new AppError(400, "Please Provide 10 digits mobile number"));
  }

  const [checkQuery] = await pool.query(
    `SELECT * FROM users WHERE phone_no = ?`,
    [phone_no]
  );

  if (checkQuery.length === 1) {
    // Update OTP in the database for the provided phone number
    const query = `UPDATE otps SET otp = ? WHERE phone_no = ?`;
    const [result, fields] = await pool.query(query, [otp, phone_no]);
    return res.status(200).json({ message: "OTP sent successfully", otp });
  }
  return next(new AppError(404, "User not found"));
});

exports.getUserDetails = asyncChoke(async (req, res, next) => {
  const id = req.user.id;

  try {
    const [userData] = await pool.query("SELECT * FROM users WHERE id = ?", [
      id,
    ]);
    return res.status(200).json({
      status: "success",
      userData,
    });
  } catch (err) {
    return next(new AppError(500, "Internal Server Got An Error", err));
  }
});

exports.updateUserOtpSender = asyncChoke(async (req, res, next) => {
  const id = req.user.id;
  const { name, email, phone_no } = req.body;
  const generateOTP = () => Math.floor(1000 + Math.random() * 9000);
  const otp = generateOTP();
  try {
    if (name !== "" && email !== "" && phone_no !== "") {
      const [email_exist] = await pool.query(
        "SELECT * FROM users WHERE email = ? AND id != ?",
        [email, id]
      );
      if (email_exist.length > 0) {
        return next(new AppError(401, "User with this email already exists"));
      }
      const [phone_exist] = await pool.query(
        "SELECT * FROM users WHERE phone_no = ? AND id != ?",
        [phone_no, id]
      );
      if (phone_exist.length > 0) {
        return next(
          new AppError(401, "User with this phone_no already exists")
        );
      }
      const [otpPhoneExist] = await pool.query(
        "SELECT * FROM otps WHERE phone_no = ?",
        [phone_no]
      );
      if (otpPhoneExist.length === 0) {
        const [otpSender] = await pool.query(
          "INSERT INTO otps (phone_no, otp) VALUES (?, ?);",
          [phone_no, otp]
        );
      } else {
        const [updateOtps] = await pool.query(
          "UPDATE otps SET otp = ? WHERE phone_no = ?",
          [otp, phone_no]
        );
      }
      return res.status(200).json({
        status: "success",
        OTP: otp,
      });
    } else {
      return next(new AppError(401, "Edit to update profile!"));
    }
  } catch (err) {
    return next(new AppError(500, "Internal Server Got An Error", err));
  }
});

exports.updateUserProfile = asyncChoke(async (req, res, next) => {
  const id = req.user.id;
  const { givenOTP } = req.body;
  const { name, email, phone_no } = req.params;
  try {
    if (givenOTP !== "" && name !== "" && email !== "" && phone_no !== "") {
      const [email_exist] = await pool.query(
        "SELECT * FROM users WHERE email = ? AND id != ?",
        [email, id]
      );
      if (email_exist.length > 0) {
        return next(new AppError(401, "User with this email already exists"));
      }
      const [phone_exist] = await pool.query(
        "SELECT * FROM users WHERE phone_no = ? AND id != ?",
        [phone_no, id]
      );
      if (phone_exist.length > 0) {
        return next(
          new AppError(401, "User with this phone_no already exists")
        );
      }
      const checkOTPQuery = `SELECT COUNT(*) AS otp_matched FROM otps WHERE phone_no = ? AND otp = ?`;
      const [otpResult] = await pool.query(checkOTPQuery, [phone_no, givenOTP]);

      if (otpResult[0].otp_matched === 0) {
        return next(new AppError(401, "Invalid OTP"));
      }
      const [updateUser] = await pool.query(
        "UPDATE users SET username = ? , email = ? , phone_no = ? WHERE id = ?",
        [name, email, phone_no, id]
      );
      if (updateUser.affectedRows === 0) {
        return next(new AppError(401, "Cannot update user, UPDATION FAILED!"));
      }
      return res.status(200).json({
        status: "success",
        message: "User profile updated successfully!",
      });
    } else {
      return next(new AppError(401, "Edit to update profile!"));
    }
  } catch (err) {
    return next(new AppError(500, "Internal Server Got An Error", err));
  }
});

exports.addAddress = asyncChoke(async (req, res, next) => {
  const id = req.user.id;
  const { state, city, area, house_no, lat, lon, type, R_name, R_phone_no } =
    req.body;
  const validTypes = ["home", "office"];
  try {
    if ((state && city && area && house_no && lat && lon && type) === "") {
      return next(new AppError(401, "Provide all required details!"));
    }

    if (!validTypes.includes(type)) {
      return next(new AppError(400, `Type cannot be ${type}`));
    }
    await pool.query(`UPDATE useraddress SET selected = ? WHERE user_id = ?`, [false, id]);
    const [userAddress] = await pool.query(
      "INSERT INTO useraddress (user_id, state, city, area, house_no, lat, lon, type, R_name, R_phone_no, selected) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      [id, state, city, area, house_no, lat, lon, type, R_name, R_phone_no,true]
    );
    if (userAddress.affectedRows === 0) {
      return next(new AppError(400, "Error: Cannot add address!"));
    }
    return res.status(200).json({
      status: "Success",
      message: "Address added!",
    });
  } catch (err) {
    return next(new AppError(500, "Internal Server Got An Error", err));
  }
});

exports.getAddedAddress = asyncChoke(async (req, res, next) => {
  const id = req.user.id;
  try {
    const [Addresses] = await pool.query(
      "SELECT * FROM userAddress WHERE user_id = ?",
      [id]
    );
    if (Addresses.length === 0) {
      return next(new AppError(404, "You have not added any address yet"));
    }
    return res.status(200).json({
      status: "success",
      data: Addresses,
    });
  } catch (err) {
    return next(new AppError(500, "Internal Server Got An Error", err));
  }
});

exports.removeAddress = asyncChoke(async (req, res, next) => {
  const id = req.user.id;
  const { address_id } = req.params;
  try {
    const [addressRemoval] = await pool.query(
      "DELETE FROM userAddress WHERE user_id = ? AND id = ? ",
      [id, address_id]
    );
    if (addressRemoval.affectedRows === 0) {
      return next(new AppError(400, "Error: Cannot remove address!"));
    }
    return res.status(200).json({
      status: "success",
      message: "Address Removed!",
    });
  } catch (err) {
    return next(new AppError(500, "Internal Server Got An Error", err));
  }
});

exports.editAddress = asyncChoke(async (req, res, next) => {
  const id = req.user.id;
  const { address_id } = req.params;
  const validTypes = ["home", "office"];
  const { state, city, area, house_no, lat, lon, type, R_name, R_phone_no } =
    req.body;
  try {
    if ((state && city && area && house_no && lat && lon && type) === "") {
      return next(new AppError(401, "Provide all required details!"));
    }

    if (!validTypes.includes(type)) {
      return next(new AppError(400, `Type cannot be ${type}`));
    }
    const [userAddress] = await pool.query(
      "UPDATE userAddress SET state = ?, city = ?, area = ?, house_no = ?, lat = ?, lon = ?, type = ?, R_name = ?, R_phone_no = ? WHERE user_id = ? AND id = ?",
      [
        state,
        city,
        area,
        house_no,
        lat,
        lon,
        type,
        R_name,
        R_phone_no,
        id,
        address_id,
      ]
    );
    if (userAddress.affectedRows === 0) {
      return next(new AppError(404, "Address not found or no changes made."));
    }
    return res.status(200).json({
      status: "Success",
      message: "Address Updated!",
    });
  } catch (err) {
    return next(new AppError(500, "Internal Server Got An Error", err));
  }
});



exports.PurchaseVerify = asyncChoke(async(req, res, next) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  await verifyPaymentOrder(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  console.log(verifyPaymentOrder);
  if((verifyPaymentOrder.status === "captured") || !verifyPaymentOrder){
    return res.redirect("http://localhost:5173/paymentSuccess");
  }
  else{
    return res.redirect("http://localhost:5173/paymentFailed");
  }
})






exports.addCard = asyncChoke(async (req, res, next) => {
  const { card_no, valid, cvv, name_on_card, nick_name } = req.body;
  const { id: user_id } = req.user; // Get user_id from the authenticated user (req.user)

  // Validate the input fields
  if (!card_no || !valid || !cvv || !name_on_card) {
    return next(new AppError(400, 'Missing required fields: card_no, valid, cvv, name_on_card.'));
  }
  const formatedvalid = convertExpiryDate(valid)

  // Insert card details into the database
  try {
    const query = `
      INSERT INTO cards (card_no, valid, cvv, name_on_card, nick_name, user_id)
      VALUES (?, ?, ?, ?, ?, ?);
    `;

    // Store the card details in the database
    await pool.query(query, [card_no, formatedvalid, cvv, name_on_card, nick_name, user_id]);

    return res.status(201).json({
      status: 'success',
      message: 'Card details added successfully.'
    });
  } catch (err) {
    console.log(err);
    return next(new AppError(500, 'Internal Server Error', err));
  }
});



// Function to add UPI details
exports.addUPI = async (req, res, next) => {
    const { upi_id } = req.body;
    const user_id = req.user.id; // Assuming user ID comes from authentication middleware
    
    // Validate UPI ID
    if (!upi_id) {
      return next(new AppError(400, 'UPI ID is required'));
    }


    try {
      // Check if UPI ID already exists in the database
      const [upiExists] = await pool.query(
        'SELECT * FROM upi_details WHERE user_id =? AND upi_id = ?',
        [user_id, upi_id]
      );
      
      if (upiExists.length > 0) {
        return res.status(409).json({ message: 'UPI ID already exists' });
      }
        // Insert UPI details into the database
        const [result] = await pool.query(
            'INSERT INTO upi_details (user_id, upi_id) VALUES (?, ?)',
            [user_id, upi_id]
        );
        
        // Respond with success message
        res.status(200).json({ message: 'UPI details added successfully'});
    } catch (error) {
        console.error(error);
        return next(new AppError(500, 'Internal Server Error', error));
    }
};


exports.rateItems = asyncChoke(async (req, res, next) => {
  const userId = req.user.id; // user_id from req.user (Authenticated user)
  const { order_id, ratings } = req.body; // order_id from request body and ratings (object containing item_id and rating)

  try {
    if(!order_id || !ratings) {
      return next(new AppError(400, 'Provide required credentials'));
    }
    // Step 1: Get items associated with the order_id from order_items
    const [orderItems] = await pool.query(
      `SELECT item_id FROM order_items WHERE order_id = ?`,
      [order_id]
    );
console.log(orderItems)
    if (orderItems.length === 0) {
      return next(new AppError(404, "No items found for the provided order_id."));
    }

    // Step 2: Check if the user has already rated an item, and prepare for insertion
    let ratedItems = [];
    let newRatings = [];
    let errors = [];

    // Step 3: Check each item from orderItems and prepare ratings
    for (let i = 0; i < orderItems.length; i++) {
      const itemId = orderItems[i].item_id;
console.log(itemId);
      // Check if user already rated the item
      const [existingRating] = await pool.query(
        `SELECT * FROM user_rated_items WHERE user_id = ? AND item_id = ?`,
        [userId, itemId]
      );
console.log("existing rating : ", existingRating);
      if (existingRating.length > 0) {
        ratedItems.push(itemId); // User has already rated this item, skip it
      } else {
        // User has not rated this item, so insert the rating
        const rating = ratings; // Get the rating from the provided ratings
        console.log(rating);
        if (rating) {
          newRatings.push({ itemId, rating });
        }
      }
    }

    // Step 4: Insert new ratings into `user_rated_items` and update `items_rating`
    for (let i = 0; i < newRatings.length; i++) {
      const { itemId, rating } = newRatings[i];
console.log(itemId);
      // Insert into user_rated_items
      await pool.query(
        `INSERT INTO user_rated_items (item_id, user_id, rating) VALUES (?, ?, ?)`,
        [itemId, userId, rating]
      );

      // Increment count and update total ratings in items_rating
      await pool.query(
        `INSERT INTO items_rating (item_id, rating, total_ratings) 
        VALUES (?, ?, 1) 
        ON DUPLICATE KEY UPDATE 
        total_ratings = total_ratings + 1`,
        [itemId, rating]
      );
    }

    return res.status(200).json({
      status: "Success",
      message: "Ratings updated successfully.",
      ratedItems: ratedItems,
      newRatings: newRatings
    });
  } catch (err) {
    return next(new AppError(500, "Internal Server Error", err));
  }
});



exports.rateRestaurant = asyncChoke(async (req, res, next) => {
  const userId = req.user.id; // Authenticated user ID
  const { restaurant_id, rating } = req.body; // Restaurant ID and rating from request body

  try {
    if (!restaurant_id || !rating) {
      return next(new AppError(400, "Provide both restaurant_id and rating."));
    }

    // Step 1: Check if the user has already rated this restaurant
    const [existingRating] = await pool.query(
      `SELECT * FROM user_rated_restaurants WHERE user_id = ? AND restaurant_id = ?`,
      [userId, restaurant_id]
    );

    if (existingRating.length > 0) {
      // User has already rated this restaurant
      return next(new AppError(400, "You have already rated this restaurant."));
    }

    // Step 2: Insert the new rating into `user_rated_restaurants`
    await pool.query(
      `INSERT INTO user_rated_restaurants (restaurant_id, user_id, rating) VALUES (?, ?, ?)`,
      [restaurant_id, userId, rating]
    );

    // Step 3: Increment `total_ratings` in `restaurants_rating`
    await pool.query(
      `INSERT INTO restaurants_rating (restaurant_id, rating_count)
       VALUES (?, 1)
       ON DUPLICATE KEY UPDATE rating_count = rating_count + 1`,
      [restaurant_id]
    );

    return res.status(200).json({
      status: "Success",
      message: "Your rating has been recorded successfully.",
    });
  } catch (err) {
    console.log(err);
    return next(new AppError(500, "Internal Server Error", err));
  }
});


