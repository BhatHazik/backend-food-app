const { request } = require("express");
const { pool } = require("../Config/database");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
const { getSocketIoServer } = require("../Utils/socketHandler");
const { uploadDocuments } = require("../Config/aws");
const { isValidPhoneNumber, createSendToken } = require("../Utils/utils");

exports.getDocumentStatus = asyncChoke(async (req, res, next) => {
  const user_id = req.user.id;

  try {
    const [[data]] = await pool.query(
      `
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
    `,
      [user_id]
    );

    if (!data) {
      return next(new AppError(404, "Delivery boy not found!"));
    }

    const completed = [];
    const pending = [];

    const checkFields = (fields, category) => {
      if (fields.every((field) => !!field)) {
        completed.push(category);
      } else {
        pending.push(category);
      }
    };

    checkFields(
      [data.first_name, data.last_name, data.profile_pic],
      "Personal Information"
    );

    checkFields(
      [
        data.adhar_front,
        data.adhar_back,
        data.pan_front,
        data.pan_back,
        data.dl_front,
        data.dl_back,
      ],
      "Delivery Documents"
    );

    checkFields(
      [
        data.vehicle_no,
        data.registration_no,
        data.vehicle_type,
        data.vehicle_image,
      ],
      "Vehicle Details"
    );

    checkFields(
      [data.account_no, data.bank_name, data.IFSC_code],
      "Bank Details"
    );

    checkFields([data.work_type], "Work Type");

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

exports.getPersonalDocsStatus = asyncChoke(async (req, res, next) => {
  const user_id = req.user.id;

  try {
    const [[data]] = await pool.query(
      `
      SELECT
        dd.adhar_front, dd.adhar_back, 
        dd.pan_front, dd.pan_back, 
        dd.dl_front, dd.dl_back
      FROM delivery_docs dd
      WHERE dd.del_id = ?
    `,
      [user_id]
    );

    if (!data) {
      return next(new AppError(404, "Personal documents not found!"));
    }

    const completed = [];
    const pending = [];

    const checkFields = (fields, category) => {
      if (fields.every((field) => !!field)) {
        completed.push(category);
      } else {
        pending.push(category);
      }
    };

    checkFields([data.adhar_front, data.adhar_back], "Aadhar Card");
    checkFields([data.pan_front, data.pan_back], "PAN Card");
    checkFields([data.dl_front, data.dl_back], "Driving License");

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

exports.updateDeliveryBank = asyncChoke(async (req, res, next) => {
  const user_id = req.user.id;
  const { account_no, bank_name, IFSC_code } = req.body;

  try {
    if (!account_no || !bank_name || !IFSC_code) {
      return next(new AppError(400, "Please provide all fields"));
    }

    const [updateBank] = await pool.query(
      `UPDATE delivery_bank SET account_no = ?, bank_name = ?, IFSC_code = ? WHERE del_id = ?`,
      [account_no, bank_name, IFSC_code, user_id]
    );
    if (updateBank.affectedRows === 0) {
      return next(new AppError(404, "Unable to load you bank details"));
    }
    res.status(200).json({
      status: "success",
      message: "Bank details updated successfully",
    });
  } catch (error) {
    console.log(error);
    return next(new AppError(500, "Internal Server Error", error));
  }
});

exports.updateDeliveryVehicle = asyncChoke(async (req, res, next) => {
  const user_id = req.user.id;
  const { vehicle_no, registration_no, vehicle_type } = req.body;
  let thumbnailUrl;
  try {
    if (!req.files) {
      return next(new AppError(400, "Please upload a vehicle image"));
    }
    thumbnailUrl = await uploadDocuments(req.files);

    if (!thumbnailUrl) {
      return next(new AppError(400, "Please provide a valid image"));
    }

    if (!vehicle_no || !registration_no || !vehicle_type) {
      return next(new AppError(400, "Please provide all fields"));
    }

    const [updateVehicle] = await pool.query(
      `UPDATE delivery_vehicles SET vehicle_no =?, registration_no =?, vehicle_type =?, vehicle_image =? WHERE del_id =?`,
      [
        vehicle_no,
        registration_no,
        vehicle_type,
        thumbnailUrl[0].vehicle_image,
        user_id,
      ]
    );
    if (updateVehicle.affectedRows === 0) {
      return next(new AppError(404, "Unable to load you vehicle details"));
    }
    res.status(200).json({
      status: "success",
      message: "Vehicle details updated successfully",
    });
  } catch (error) {
    console.log(error);
    return next(new AppError(500, "Internal Server Error", error));
  }
});

exports.updateDeliveryPersonal = asyncChoke(async (req, res, next) => {
  const user_id = req.user.id;
  const { first_name, last_name, gender } = req.body;

  let thumbnailUrl;

  try {
    if (!first_name || !last_name || !gender) {
      return next(new AppError(400, "Please provide all fields"));
    }

    thumbnailUrl = await uploadDocuments(req.files);

    if (!thumbnailUrl) {
      return next(new AppError(400, "Please provide a valid image"));
    }
    const [updatePersonal] = await pool.query(
      `UPDATE delivery_boys SET first_name = ?, last_name = ?, gender = ?, profile_pic = ? WHERE id =?`,
      [first_name, last_name, gender, thumbnailUrl[0].profile_pic, user_id]
    );
    if (updatePersonal.affectedRows === 0) {
      return next(new AppError(404, "Unable to load you personal details"));
    }
    res.status(200).json({
      status: "success",
      message: "Personal details updated successfully",
    });
  } catch (error) {
    console.log(error);
    return next(new AppError(500, "Internal Server Error", error));
  }
});

exports.updateDeliveryDocs = asyncChoke(async (req, res, next) => {
  const user_id = req.user.id;
  const { adhar_front, adhar_back, pan_front, pan_back, dl_front, dl_back } =
    req.body;

  try {
    if (
      !adhar_front ||
      !adhar_back ||
      !pan_front ||
      !pan_back ||
      !dl_front ||
      !dl_back
    ) {
      return next(new AppError(400, "Please provide all fields"));
    }

    const [updateDocs] = await pool.query(
      `UPDATE delivery_docs SET adhar_front = ?, adhar_back = ?, pan_front = ?, pan_back = ?, dl_front = ?, dl_back = ? WHERE del_id = ?`,
      [adhar_front, adhar_back, pan_front, pan_back, dl_front, dl_back, user_id]
    );
    if (updateDocs.affectedRows === 0) {
      return next(new AppError(404, "Unable to load you documents"));
    }
    res.status(200).json({
      status: "success",
      message: "Documents updated successfully",
    });
  } catch (error) {
    console.log(error);
    return next(new AppError(500, "Internal Server Error", error));
  }
});

exports.updateAdharDocs = asyncChoke(async (req, res, next) => {
  const user_id = req.user.id;
  const files = req.files;

  try {
    const uploadedUrls = await uploadDocuments(files);

    const adharFrontUrl = uploadedUrls.find(
      (urlObj) => urlObj.adhar_front
    )?.adhar_front;
    const adharBackUrl = uploadedUrls.find(
      (urlObj) => urlObj.adhar_back
    )?.adhar_back;

    if (!adharFrontUrl || !adharBackUrl) {
      return next(
        new AppError(400, "Both Aadhar front and back images must be uploaded")
      );
    }

    const [updateDocs] = await pool.query(
      `UPDATE delivery_docs SET adhar_front = ?, adhar_back = ? WHERE del_id = ?`,
      [adharFrontUrl, adharBackUrl, user_id]
    );

    if (updateDocs.affectedRows === 0) {
      return next(new AppError(404, "Unable to update Aadhar documents"));
    }

    res.status(200).json({
      status: "success",
      message: "Aadhar documents updated successfully",
    });
  } catch (error) {
    console.log(error);
    return next(new AppError(500, "Internal Server Error", error));
  }
});

exports.updatePanDocs = asyncChoke(async (req, res, next) => {
  const user_id = req.user.id;

  try {
    const uploadedUrls = await uploadDocuments(req.files);

    const panFrontUrl = uploadedUrls.find(
      (urlObj) => urlObj.pan_front
    )?.pan_front;
    const panBackUrl = uploadedUrls.find((urlObj) => urlObj.pan_back)?.pan_back;

    if (!panFrontUrl || !panBackUrl) {
      return next(
        new AppError(400, "Both Apan front and back images must be uploaded")
      );
    }

    const [updateDocs] = await pool.query(
      `UPDATE delivery_docs SET pan_front = ?, pan_back = ? WHERE del_id = ?`,
      [panFrontUrl, panBackUrl, user_id]
    );

    if (updateDocs.affectedRows === 0) {
      return next(new AppError(404, "Unable to update PAN documents"));
    }

    res.status(200).json({
      status: "success",
      message: "PAN documents updated successfully",
    });
  } catch (error) {
    console.log(error);
    return next(new AppError(500, "Internal Server Error", error));
  }
});

exports.updateDlDocs = asyncChoke(async (req, res, next) => {
  const user_id = req.user.id;

  try {
    const uploadedUrls = await uploadDocuments(req.files);

    const dlFrontUrl = uploadedUrls.find((urlObj) => urlObj.dl_front)?.dl_front;
    const dlBackUrl = uploadedUrls.find((urlObj) => urlObj.dl_back)?.dl_back;

    if (!dlFrontUrl || !dlBackUrl) {
      return next(
        new AppError(400, "Both Adl front and back images must be uploaded")
      );
    }

    const [updateDocs] = await pool.query(
      `UPDATE delivery_docs SET dl_front = ?, dl_back = ? WHERE del_id = ?`,
      [dlFrontUrl, dlBackUrl, user_id]
    );

    if (updateDocs.affectedRows === 0) {
      return next(new AppError(404, "Unable to update DL documents"));
    }

    res.status(200).json({
      status: "success",
      message: "DL documents updated successfully",
    });
  } catch (error) {
    console.log(error);
    return next(new AppError(500, "Internal Server Error", error));
  }
});

exports.updateWorkType = asyncChoke(async (req, res, next) => {
  const user_id = req.user.id;
  const { type } = req.body;

  try {
    if (!type) {
      return next(new AppError(400, "Please provide type"));
    }

    const [updateWorkType] = await pool.query(
      `UPDATE delivery_work SET type = ? WHERE del_id = ?`,
      [type, user_id]
    );
    if (updateWorkType.affectedRows === 0) {
      return next(new AppError(404, "Unable to load you work type"));
    }
    res.status(200).json({
      status: "success",
      message: "Work type updated successfully",
    });
  } catch (error) {
    console.log(error);
    return next(new AppError(500, "Internal Server Error", error));
  }
});

exports.sendApprovalRequest = asyncChoke(async (req, res, next) => {
  const user_id = req.user.id;

  const [getDocsStatus] = await pool.query(
    `
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
  `,
    [user_id]
  );
  if (getDocsStatus[0].approved === "pending") {
    return next(
      new AppError(400, "Request is already in a pending approval check")
    );
  }
  if (getDocsStatus[0].approved === "approved") {
    return next(new AppError(400, "Request is already approved"));
  }

  if (getDocsStatus.length === 0) {
    return next(new AppError(404, "Delivery boy details are pending"));
  }

  const details = getDocsStatus[0];

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

  const [updateApproval] = await pool.query(
    `UPDATE delivery_boys SET approved = 'pending' WHERE id = ?`,
    [user_id]
  );

  if (updateApproval.affectedRows === 1) {
    return res
      .status(200)
      .json({ message: "Approval request sent successfully" });
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

  phone_no = String(phone_no).trim();

  if (!phone_no) {
    return next(new AppError(400, "Fill all fieldss"));
  }

  if (!isValidPhoneNumber(phone_no)) {
    return next(new AppError(400, "Please Provide 10 digits mobile number"));
  }
  const [checkQuery] = await pool.query(
    `SELECT * FROM otps WHERE phone_no = ?`,
    [phone_no]
  );

  if (checkQuery.length === 1) {
    const query = `UPDATE otps SET otp = ? WHERE phone_no = ?`;
    const [result, fields] = await pool.query(query, [otp, phone_no]);

    return res.status(200).json({ message: "OTP sent successfully", otp });
  }
  const [insertQuery] = await pool.query(
    `INSERT INTO otps (phone_no, otp) VALUES (?,?)`,
    [phone_no, otp]
  );

  return res
    .status(200)
    .json({ message: "OTP sent successfully", otp, phone_no });
});

exports.deliveryLogin = asyncChoke(async (req, res, next) => {
  const { givenOTP } = req.body;
  const phone_no = req.params.phNO;
  const role = "delivery_boy";

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
    const otpQuery = `
      SELECT COUNT(*) AS otp_matched
      FROM otps
      WHERE phone_no = ?
        AND otp = ?;
    `;
    const [otpResult] = await pool.query(otpQuery, [phone_no, givenOTP]);

    if (otpResult[0].otp_matched === 1) {
      const approved = checkQuery[0].approved;
      const token = createSendToken(res, req, phone_no, role);
      return res
        .status(200)
        .json({ message: "Login success", token, approved });
    } else {
      return next(new AppError(401, "Invalid OTP"));
    }
  } else {
    const otpQuery = `
      SELECT COUNT(*) AS otp_matched
      FROM otps
      WHERE phone_no = ?
        AND otp = ?;
    `;
    const [otpResult] = await pool.query(otpQuery, [phone_no, givenOTP]);

    if (otpResult[0].otp_matched === 1) {
      const [deliverySignUp] = await pool.query(
        `INSERT INTO delivery_boys (phone_no) VALUES (?);`,
        [phone_no]
      );

      if (deliverySignUp.affectedRows === 1) {
        const del_id = deliverySignUp.insertId;

        const queries = [
          pool.query(`INSERT INTO delivery_docs (del_id) VALUES (?);`, [
            del_id,
          ]),
          pool.query(`INSERT INTO delivery_vehicles (del_id) VALUES (?);`, [
            del_id,
          ]),
          pool.query(`INSERT INTO delivery_bank (del_id) VALUES (?);`, [
            del_id,
          ]),
          pool.query(`INSERT INTO delivery_work (del_id) VALUES (?);`, [
            del_id,
          ]),
        ];

        await Promise.all(queries);

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

exports.acceptOrder = asyncChoke(async (req, res, next) => {
  const { order_id } = req.query;
  const { id: delivery_boy_id } = req.user;
  try {
    if (!order_id) {
      return next(new AppError(400, "Order id required"));
    }

    const [order] = await pool.query(`SELECT * FROM orders WHERE id = ?`, [
      order_id,
    ]);
    if (order.length === 0) {
      return next(new AppError(404, "Order not found"));
    }

    if (order[0].del_id) {
      return next(
        new AppError(400, "Order already accepted by another delivery boy")
      );
    }
    const [updateOrder] = await pool.query(
      `UPDATE orders SET del_id = ? WHERE id = ?;`,
      [delivery_boy_id, order_id]
    );

    if (updateOrder.affectedRows === 1) {
      const [updatedOrder] = await pool.query(
        `
        SELECT o.id AS order_id,
        o.user_id,
        o.restaurant_id,
        o.del_amount,
        o.created_at,
        o.del_id,
        d.phone_no AS del_phone_no
        FROM orders o 
        JOIN delivery_boys d ON d.id = o.del_id
        WHERE o.id = ?`,
        [order_id]
      );
      const dataTosend = {
        status: "accepted",
        message: `Order ${order_id} has been accepted by delivery boy`,
        order_details: updatedOrder[0],
      };
      const io = getSocketIoServer();

      const restaurantSocket = io.connectedRestaurants[order[0].restaurant_id];
      if (restaurantSocket) {
        io.to(restaurantSocket).emit("orderAcceptedDelivery", dataTosend);
      }
      const userSocket = io.connectedUsers[order[0].user_id];
      if (userSocket) {
        io.to(userSocket).emit("orderStatus", dataTosend);
      }
      return res
        .status(200)
        .json({ status: "accepted", message: "Order accepted successfully" });
    } else {
      return next(new AppError(500, "Failed to accept order"));
    }
  } catch (err) {
    console.log(err);
    return next(new AppError(500, "Server Error", err));
  }
});

exports.getEarningsAndDutyTime = asyncChoke(async (req, res, next) => {
  const { id: deliveryBoyId } = req.user;

  try {
    const [orders] = await pool.query(
      `
      SELECT del_amount, TIMESTAMPDIFF(MINUTE, created_at, updated_at) AS duration
      FROM orders 
      WHERE del_id = ? AND order_status = 'delivered'
    `,
      [deliveryBoyId]
    );

    let totalEarnings = 0;
    let totalMinutes = 0;

    orders.forEach((order) => {
      totalEarnings += parseFloat(order.del_amount || 0);
      totalMinutes += order.duration || 0;
    });

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return res.status(200).json({
      status: "success",
      message: "Earnings and duty time calculated successfully",
      data: {
        total_earnings: totalEarnings.toFixed(2),
        duty_time: `${hours} hours and ${minutes} mins`,
      },
    });
  } catch (err) {
    console.error(err);
    return next(new AppError(500, "Server Error", err));
  }
});

exports.confirmOrder = asyncChoke(async (req, res, next) => {
  const { order_id } = req.query;
  const { id: delivery_boy_id } = req.user;
  try {
    if (!order_id) {
      return next(new AppError(400, "Order id required"));
    }
    const [order] = await pool.query(`SELECT * FROM orders WHERE id = ?`, [
      order_id,
    ]);
    if (order.length === 0) {
      return next(new AppError(404, "Order not found"));
    }

    if (!order[0].del_id || order[0].del_id !== delivery_boy_id) {
      return next(new AppError(401, "Unauthorized"));
    }
    if (order[0].order_status === "on thy way") {
      return next(new AppError(400, "Order already confirmed"));
    }
    await pool.query(
      `UPDATE orders SET order_status = 'on the way' WHERE id = ?;`,
      [order_id]
    );
    const io = getSocketIoServer();
    const restaurantSocket = io.connectedRestaurants[order[0].restaurant_id];
    if (restaurantSocket) {
      io.to(restaurantSocket).emit("orderAcceptedDelivery", {
        status: "Order picked by delivery boy",
        order_id,
      });
    }
    const userSocket = io.connectedUsers[order[0].user_id];
    if (userSocket) {
      io.to(userSocket).emit("orderStatus", { status: "On the way", order_id });
    }
    return res
      .status(200)
      .json({ status: "on the way", message: "Order confirmed successfully" });
  } catch (err) {
    console.log(err);
    return next(new AppError(500, "Server Error", err));
  }
});

exports.arrivedOrder = asyncChoke(async (req, res, next) => {
  const { order_id } = req.query;
  const { id: delivery_boy_id } = req.user;
  try {
    if (!order_id) {
      return next(new AppError(400, "Order id required"));
    }
    const [order] = await pool.query(`SELECT * FROM orders WHERE id = ?`, [
      order_id,
    ]);
    if (order.length === 0) {
      return next(new AppError(404, "Order not found"));
    }

    if (!order[0].del_id || order[0].del_id !== delivery_boy_id) {
      return next(new AppError(401, "Unauthorized"));
    }
    if (order[0].order_status === "arrived") {
      return next(new AppError(400, "Order already arrived"));
    }
    await pool.query(`UPDATE orders SET order_status = ? WHERE id = ?;`, [
      "arrived",
      order_id,
    ]);
    const io = getSocketIoServer();
    const userSocket = io.connectedUsers[order[0].user_id];
    if (userSocket) {
      io.to(userSocket).emit("orderStatus", { status: "arrived", order_id });
    }
    return res
      .status(200)
      .json({ status: "arrived", message: "Order arrived successfully" });
  } catch (err) {
    console.log(err);
    return next(new AppError(500, "Server Error", err));
  }
});

exports.deliverOrder = asyncChoke(async (req, res, next) => {
  const { order_id } = req.query;
  const { id: delivery_boy_id } = req.user;
  try {
    if (!order_id) {
      return next(new AppError(400, "Order id required"));
    }
    const [order] = await pool.query(`SELECT * FROM orders WHERE id = ?`, [
      order_id,
    ]);
    if (order.length === 0) {
      return next(new AppError(404, "Order not found"));
    }

    if (!order[0].del_id || order[0].del_id !== delivery_boy_id) {
      return next(new AppError(401, "Unauthorized"));
    }
    if (order[0].order_status === "delivered") {
      return next(new AppError(400, "Order already delivered"));
    }
    await pool.query(`UPDATE orders SET order_status = ? WHERE id = ?;`, [
      "delivered",
      order_id,
    ]);
    const io = getSocketIoServer();
    const userSocket = io.connectedUsers[order[0].user_id];
    if (userSocket) {
      io.to(userSocket).emit("orderStatus", { status: "delivered", order_id });
    }
    return res
      .status(200)
      .json({ status: "delivered", message: "Order delivered successfully" });
  } catch (err) {
    console.log(err);
    return next(new AppError(500, "Server Error", err));
  }
});

exports.goOnline = asyncChoke(async (req, res, next) => {
  const { id: del_id } = req.user;
  const { status } = req.body;
  try {
    if (status !== "online" && status !== "offline") {
      return next(
        new AppError(400, "Invalid status. Only online or offline is allowed")
      );
    }
    const [updateStatus] = await pool.query(
      `UPDATE delivery_work SET status = ? WHERE del_id = ?;`,
      [status, del_id]
    );
    if (updateStatus.affectedRows === 1) {
      return res.status(200).json({ message: "Status updated successfully" });
    } else {
      return next(new AppError(500, "Failed to update status"));
    }
  } catch (err) {
    return next(new AppError(500, "Server Error", err));
  }
});
