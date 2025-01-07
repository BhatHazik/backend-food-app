const { pool } = require("../Config/database");
const jwt = require("jsonwebtoken");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
const {
  isValidPhoneNumber,
  convertExpiryDate,
  createSendToken,
  validateEmail,
} = require("../Utils/utils");
const { verifyPaymentOrder } = require("../Utils/razorpay");
const { getSocketIoServer } = require("../Utils/socketHandler");

exports.createUserOTP = asyncChoke(async (req, res, next) => {
  const generateOTP = () => Math.floor(1000 + Math.random() * 9000);
  const otp = generateOTP();
  const { username, email, phone_no } = req.body;

  if (username !== "" && email !== "" && phone_no !== "") {
    if (!isValidPhoneNumber(phone_no)) {
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

      return res.status(200).json({
        message: "otp sent successfully",
        data: { username, email, phone_no, otp },
      });
    }
  } else {
    return next(new AppError(400, "fill all feilds"));
  }
});

exports.userSignUp = asyncChoke(async (req, res, next) => {
  const { givenOTP } = req.body;
  const { name, email, phNO: phone_no } = req.params;
  const role = "user";

  if (givenOTP !== "" && phone_no !== "" && email !== "" && name !== "") {
    if (!isValidPhoneNumber(phone_no)) {
      return next(new AppError(400, "Please Provide 10 digits mobile number"));
    }
    if (!validateEmail(email)) {
      return next(new AppError(400, "Please enter a valid email"));
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
    const token = createSendToken(res, req, phone_no, role);
    const insertUserQuery = `INSERT INTO users (username, email, phone_no) VALUES (?, ?, ?)`;
    await pool.query(insertUserQuery, [name, email, phone_no]);
    const userDataQuery = `SELECT * FROM users WHERE phone_no = ?`;
    const userValue = [phone_no];
    const [result] = await pool.query(userDataQuery, userValue);
    const cartQuery = `INSERT INTO cart (user_id) VALUES(?)`;
    const value = [result[0].id];
    await pool.query(cartQuery, value);
    return res
      .status(200)
      .json({
        status: "Success",
        userData: result[0],
        message: "Account created successfully",
        token,
      });
  } else {
    return next(new AppError(400, "Fill all fields"));
  }
});

exports.userLogin = asyncChoke(async (req, res, next) => {
  const { givenOTP } = req.body;
  const { phone_no } = req.params;
  const role = "user";
  if (givenOTP !== "" && phone_no !== "") {
    if (!isValidPhoneNumber(phone_no)) {
      return next(new AppError(400, "Please Provide 10 digits mobile number"));
    }

    const checkUserQuery = `SELECT * FROM users WHERE phone_no = ?`;
    const [userResult] = await pool.query(checkUserQuery, [phone_no]);

    if (userResult.length > 0) {
      const checkOTPQuery = `SELECT COUNT(*) AS otp_matched FROM otps WHERE phone_no = ? AND otp = ?`;
      const [otpResult] = await pool.query(checkOTPQuery, [phone_no, givenOTP]);

      if (otpResult[0].otp_matched === 0) {
        return next(new AppError(401, "Invalid OTP"));
      }
      const token = createSendToken(res, req, phone_no, role);
      return res
        .status(200)
        .json({
          status: "Success",
          message: "Logged in successfully",
          userData: userResult[0],
          token,
        });
    } else {
      return next(new AppError(404, "User not found"));
    }
  } else {
    return next(new AppError(400, "Fill all fields"));
  }
});

exports.readUsers = async (req, res) => {
  const query = `SELECT * FROM users`;
  const [result, fields] = await pool.query(query);
  res.status(200).json({ result });
};

exports.updateUser = asyncChoke(async (req, res, next) => {
  const { newUsername, oldUsername, phone_no } = req.body;

  if (!newUsername || !oldUsername || !phone_no) {
    return next(new AppError(400, "Fill all fields"));
  }

  const query = `UPDATE users SET username = ?, phone_no = ? WHERE username = ? AND phone_no = ?`;
  const [result, fields] = await pool.query(query, [
    newUsername,
    phone_no,
    oldUsername,
    phone_no,
  ]);

  return res.status(200).json({ result });
});

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

exports.userOTPsender = asyncChoke(async (req, res, next) => {
  const generateOTP = () => {
    return Math.floor(1000 + Math.random() * 9000);
  };

  const otp = generateOTP();
  const { phone_no } = req.body;

  if (!phone_no) {
    return next(new AppError(400, "Fill all fields"));
  }
  if (!isValidPhoneNumber(phone_no)) {
    return next(new AppError(400, "Please Provide 10 digits mobile number"));
  }

  const [checkQuery] = await pool.query(
    `SELECT * FROM users WHERE phone_no = ?`,
    [phone_no]
  );

  if (checkQuery.length === 1) {
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
    await pool.query(`UPDATE useraddress SET selected = ? WHERE user_id = ?`, [
      false,
      id,
    ]);
    const [userAddress] = await pool.query(
      "INSERT INTO useraddress (user_id, state, city, area, house_no, lat, lon, type, R_name, R_phone_no, selected) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      [
        id,
        state,
        city,
        area,
        house_no,
        lat,
        lon,
        type,
        R_name,
        R_phone_no,
        true,
      ]
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

exports.PurchaseVerify = asyncChoke(async (req, res, next) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return next(new AppError(400, "Missing payment credentials"));
  }
  const transaction = await verifyPaymentOrder(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  );
  const notes = transaction.notes;
  if (transaction.status === "captured" || !transaction) {
    try {
      const [cartItems] = await pool.query(
        `
      SELECT 
        ci.id AS cart_item_id, 
        ci.item_id AS item_id, 
        ci.quantity AS quantity, 
        c.id AS cart_id, 
        r.id AS restaurant_id,
        i.customisation 
      FROM users u
      JOIN cart c ON u.id = c.user_id
      JOIN cart_items ci ON c.id = ci.cart_id
      JOIN items i ON ci.item_id = i.id
      JOIN categories cat ON i.category_id = cat.id
      JOIN menus m ON cat.menu_id = m.id
      JOIN restaurants r ON m.restaurant_id = r.id
      WHERE u.id = ?
    `,
        [notes.user_id]
      );

      if (!cartItems.length) {
        return next(new AppError(400, "No items in the cart!"));
      }
      const [billInsertion] = await pool.query(
        `INSERT INTO bills (item_total,delivery_fee,item_discount, delivery_tip, platform_fee,gst_and_restaurant_charges,total_bill, user_id, transaction_id, payment_type) VALUES(?,?,?,?,?,?,?,?,?,?)`,
        [
          notes.bill.item_total,
          notes.bill.delivery_fee,
          notes.bill.item_discount,
          notes.bill.delivery_tip,
          notes.bill.platform_fee,
          notes.bill.gst_and_restaurant_charges,
          notes.bill.total_bill,
          notes.user_id,
          notes.transaction_id,
          transaction.method,
        ]
      );

      if (notes.offer_id) {
        const [useOffer] = await pool.query(
          `INSERT INTO user_used_offer (user_id, offer_id) VALUES(?,?)`,
          [notes.user_id, notes.offer_id]
        );
      }
      const [order] = await pool.query(
        `
      INSERT INTO orders (user_id, restaurant_id, order_status, bill_id, res_amount, del_amount) 
      VALUES (?, ?, ?,?,?,?)
    `,
        [
          notes.user_id,
          cartItems[0].restaurant_id,
          "pending",
          billInsertion.insertId,
          notes.bill.item_total,
          notes.bill.delivery_fee,
        ]
      );

      const [insertAddress] = await pool.query(
        `
      INSERT INTO orderaddress
      (state, city, area, house_no, lat, lon, type, R_name, R_phone_no, user_id, order_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?);
      `,
        [
          notes.user_address.state,
          notes.user_address.city,
          notes.user_address.area,
          notes.user_address.house_no,
          notes.user_address.lat,
          notes.user_address.lon,
          notes.user_address.type,
          notes.user_address.R_name,
          notes.user_address.R_phone_no,
          notes.user_id,
          order.insertId,
        ]
      );

      for (let i = 0; i < cartItems.length; i++) {
        const [orderItem] = await pool.query(
          `
        INSERT INTO order_items (order_id, item_id, quantity) 
        VALUES (?, ?, ?)
      `,
          [order.insertId, cartItems[i].item_id, cartItems[i].quantity]
        );

        if (cartItems[i].customisation) {
          const [customization] = await pool.query(
            `
          SELECT * FROM cart_item_customizations 
          WHERE cart_item_id = ?
        `,
            [cartItems[i].cart_item_id]
          );

          if (customization.length > 0) {
            for (const custom of customization) {
              await pool.query(
                `
              INSERT INTO order_item_customisation (order_items_id, title_id, option_id) 
              VALUES (?, ?, ?)
            `,
                [orderItem.insertId, custom.title_id, custom.option_id]
              );
            }
          }
        }
      }

      const io = getSocketIoServer();
      const restaurantSocket =
        io.connectedRestaurants[cartItems[0].restaurant_id];
      if (restaurantSocket) {
        const restaurant_id = cartItems[0].restaurant_id;
        const order_id = order.insertId;

        const [orders] = await pool.query(
          `
          SELECT
              o.id, 
              o.res_amount, 
              o.created_at,
              o.user_id, 
              o.restaurant_id, 
              o.bill_id,
              o.order_status,
              oa.area AS user_area,
              oa.house_no AS user_house_no,
              oa.city AS user_city,
              oa.lat AS user_latitude,
              oa.lon AS user_longitude,
              ra.street AS restaurant_street,
              ra.area AS restaurant_area,
              ra.city AS restaurant_city,
              ra.latitude AS restaurant_latitude,
              ra.longitude AS restaurant_longitude,
              b.payment_type
          FROM orders o
          JOIN orderaddress oa ON oa.order_id = o.id
          JOIN restaurantaddress ra ON ra.restaurant_id = o.restaurant_id
          JOIN bills b ON b.id = o.bill_id
          WHERE o.restaurant_id = ? AND o.id = ?`,
          [restaurant_id, order_id]
        );

        if (orders.length === 0) {
          return next(
            new AppError(
              404,
              "Order not found or does not belong to this restaurant"
            )
          );
        }

        const fetchOrderItemsQuery = `
          SELECT 
              oi.order_id,
              o.created_at,
              oi.id as order_item_id, 
              oi.item_id,
              oi.quantity, 
              i.name as item_name, 
              i.price as item_price
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          JOIN items i ON oi.item_id = i.id
          WHERE oi.order_id = ?
        `;
        const [orderItems] = await pool.query(fetchOrderItemsQuery, [order_id]);

        if (orderItems.length === 0) {
          return res.status(200).json({
            status: "success",
            data: {
              order_details: orders[0],
              items: [],
            },
          });
        }

        const fetchCustomizationsQuery = `
          SELECT
              oic.order_items_id,
              oic.title_id,
              ct.title,
              oic.option_id,
              co.option_name,
              co.additional_price,
              ct.selection_type
          FROM order_item_customisation oic
          JOIN customisation_title ct ON oic.title_id = ct.id
          JOIN customisation_options co ON oic.option_id = co.id
          WHERE oic.order_items_id IN (?)
        `;
        const orderItemIds = orderItems.map((item) => item.order_item_id);
        const [customizations] = await pool.query(fetchCustomizationsQuery, [
          orderItemIds,
        ]);

        const customizationsByOrderItem = {};
        customizations.forEach((customization) => {
          const {
            order_items_id,
            title,
            option_id,
            option_name,
            additional_price,
            selection_type,
            title_id,
          } = customization;

          if (!customizationsByOrderItem[order_items_id]) {
            customizationsByOrderItem[order_items_id] = {};
          }

          if (!customizationsByOrderItem[order_items_id][title]) {
            customizationsByOrderItem[order_items_id][title] = {
              selection_type,
              title,
              title_id,
              options: [],
            };
          }

          customizationsByOrderItem[order_items_id][title].options.push({
            option_id,
            option_name,
            additional_price,
          });
        });

        const resultItems = orderItems.map((item) => ({
          ...item,
          customizations: customizationsByOrderItem[item.order_item_id] || {},
        }));

        const data = {
          order_details: orders[0],
          items: resultItems,
        };
        io.to(restaurantSocket).emit("newOrder", data);
      }

      return res.status(200).json({
        status: "success",
        message: "Order initiated successfully",
        data: {
          cartItems: cartItems,
          bill: notes.bill,
        },
      });
    } catch (error) {
      console.log(error);
      return next(new AppError(500, "Internal Server Error", error));
    }
  } else {
    return next(new AppError(417, "Payment Failed"));
  }
});

exports.addCard = asyncChoke(async (req, res, next) => {
  const { card_no, valid, cvv, name_on_card, nick_name } = req.body;
  const { id: user_id } = req.user;

  if (!card_no || !valid || !cvv || !name_on_card) {
    return next(
      new AppError(
        400,
        "Missing required fields: card_no, valid, cvv, name_on_card."
      )
    );
  }
  if (!/^\d{16}$/.test(card_no)) {
    return next(new AppError(400, "Card number must be exactly 16 digits"));
  }
  const formatedvalid = convertExpiryDate(valid);

  try {
    const query = `
      INSERT INTO cards (card_no, valid, cvv, name_on_card, nick_name, user_id)
      VALUES (?, ?, ?, ?, ?, ?);
    `;

    await pool.query(query, [
      card_no,
      formatedvalid,
      cvv,
      name_on_card,
      nick_name,
      user_id,
    ]);

    return res.status(201).json({
      status: "success",
      message: "Card details added successfully.",
    });
  } catch (err) {
    console.log(err);
    return next(new AppError(500, "Internal Server Error", err));
  }
});

exports.addUPI = async (req, res, next) => {
  const { upi_id } = req.body;
  const user_id = req.user.id;

  if (!upi_id) {
    return next(new AppError(400, "UPI ID is required"));
  }

  try {
    const [upiExists] = await pool.query(
      "SELECT * FROM upi_details WHERE user_id =? AND upi_id = ?",
      [user_id, upi_id]
    );

    if (upiExists.length > 0) {
      return res.status(409).json({ message: "UPI ID already exists" });
    }

    const [result] = await pool.query(
      "INSERT INTO upi_details (user_id, upi_id) VALUES (?, ?)",
      [user_id, upi_id]
    );

    res.status(200).json({ message: "UPI details added successfully" });
  } catch (error) {
    console.error(error);
    return next(new AppError(500, "Internal Server Error", error));
  }
};

exports.fetchPayments = asyncChoke(async (req, res, next) => {
  const user_id = req.user.id;
  try {
    const [UPIs] = await pool.query(
      `SELECT * FROM upi_details WHERE user_id = ?`,
      [user_id]
    );
    const [cards] = await pool.query(`SELECT * FROM cards WHERE user_id = ?`, [
      user_id,
    ]);
    const paymentData = {
      UPIs: UPIs,
      cards: cards,
    };
    res.status(200).json({
      status: "success",
      data: paymentData,
    });
  } catch (error) {
    console.error(error);
    return next(new AppError(500, "Internal Server Error", error));
  }
});

exports.rateItems = asyncChoke(async (req, res, next) => {
  const userId = req.user.id;
  const { order_id, ratings } = req.body;

  try {
    if (!order_id || !ratings) {
      return next(new AppError(400, "Provide required credentials"));
    }

    const [orderItems] = await pool.query(
      `SELECT item_id FROM order_items WHERE order_id = ?`,
      [order_id]
    );
    if (orderItems.length === 0) {
      return next(
        new AppError(404, "No items found for the provided order_id.")
      );
    }

    let ratedItems = [];
    let newRatings = [];
    let errors = [];

    for (let i = 0; i < orderItems.length; i++) {
      const itemId = orderItems[i].item_id;

      const [existingRating] = await pool.query(
        `SELECT * FROM user_rated_items WHERE user_id = ? AND item_id = ?`,
        [userId, itemId]
      );
      if (existingRating.length > 0) {
        ratedItems.push(itemId);
      } else {
        const rating = ratings;
        if (rating) {
          newRatings.push({ itemId, rating });
        }
      }
    }

    for (let i = 0; i < newRatings.length; i++) {
      const { itemId, rating } = newRatings[i];
      await pool.query(
        `INSERT INTO user_rated_items (item_id, user_id, rating) VALUES (?, ?, ?)`,
        [itemId, userId, rating]
      );

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
      newRatings: newRatings,
    });
  } catch (err) {
    return next(new AppError(500, "Internal Server Error", err));
  }
});

exports.rateRestaurant = asyncChoke(async (req, res, next) => {
  const userId = req.user.id;
  const { restaurant_id, rating } = req.body;

  try {
    if (!restaurant_id || !rating) {
      return next(new AppError(400, "Provide both restaurant_id and rating."));
    }

    const [existingRating] = await pool.query(
      `SELECT * FROM user_rated_restaurants WHERE user_id = ? AND restaurant_id = ?`,
      [userId, restaurant_id]
    );

    if (existingRating.length > 0) {
      return next(new AppError(400, "You have already rated this restaurant."));
    }

    await pool.query(
      `INSERT INTO user_rated_restaurants (restaurant_id, user_id, rating) VALUES (?, ?, ?)`,
      [restaurant_id, userId, rating]
    );

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
