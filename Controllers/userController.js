const db = require("../Config/database");
const jwt = require("jsonwebtoken");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");

// create or signup with otp

// create otp on number
// createUserOTP API
exports.createUserOTP = asyncChoke(async (req, res, next) => {
  const generateOTP = () => Math.floor(1000 + Math.random() * 9000);
  const otp = generateOTP();
  const { username, email, phone_no } = req.body;

  if (username !== "" && email !== "" && phone_no !== "") {
    const checkQuery = `SELECT * FROM users WHERE phone_no = ? OR email = ?;`;
    const [checkResult] = await db.query(checkQuery, [phone_no, email]);

    if (checkResult.length > 0) {
      return next(new AppError(400, "Phone number or email already exists"));
    } else {
      const insertQuery = `INSERT INTO otps (phone_no, otp) VALUES (?, ?);`;
      await db.query(insertQuery, [phone_no, otp]);

      return res.status(200).json({ username, email, phone_no, otp });
    }
  } else {
    return next(new AppError(400, "fill all feilds"));
  }
});

const createSendToken = (res, req, phone_no) => {
  const tokenOptions = { expiresIn: process.env.JWT_EXPIRY };
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
    const checkUserQuery = `SELECT COUNT(*) AS phone_exist FROM users WHERE phone_no = ?`;
    const [userResult] = await db.query(checkUserQuery, [phone_no]);

    if (userResult[0].phone_exist > 0) {
      // return next(new AppError(409, 'user already exists'));
      const checkOTPQuery = `SELECT COUNT(*) AS otp_matched FROM otps WHERE phone_no = ? AND otp = ?`;
      const [otpResult] = await db.query(checkOTPQuery, [phone_no, givenOTP]);

      if (otpResult[0].otp_matched === 0) {
        return next(new AppError(401, "Invalid OTP"));
      }
      const token = createSendToken(res, req, phone_no);
      return res.status(200).json({ message: "Logged in successfully", token });
    }

    const checkOTPQuery = `SELECT COUNT(*) AS otp_matched FROM otps WHERE phone_no = ? AND otp = ?`;
    const [otpResult] = await db.query(checkOTPQuery, [phone_no, givenOTP]);

    if (otpResult[0].otp_matched === 0) {
      return next(new AppError(401, "Invalid OTP"));
    }
    const token = createSendToken(res, req, phone_no);
    const insertUserQuery = `INSERT INTO users (username, email, phone_no) VALUES (?, ?, ?)`;
    await db.query(insertUserQuery, [name, email, phone_no]);
    const userDataQuery = `SELECT * FROM users WHERE phone_no = ?`;
    const userValue = [phone_no];
    const [result] = await db.query(userDataQuery, userValue);
    const cartQuery = `INSERT INTO cart (user_id) VALUES(?)`;
    const value = [result[0].id];
    await db.query(cartQuery, value);
    console.log("ok");
    return res.status(200).json({ message: "Account created", token });
  } else {
    return next(new AppError(400, "Fill all fields"));
  }
});

// read

exports.readUsers = async (req, res) => {
  const query = `SELECT * FROM user`;
  const [result, fields] = await db.query(query);
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
  const [result, fields] = await db.query(query, [
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
  const [result] = await db.query(query, ["inactive", id]);

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

  const [checkQuery] = await db.query(
    `SELECT * FROM users WHERE phone_no = ?`,
    [phone_no]
  );

  if (checkQuery.length === 1) {
    // Update OTP in the database for the provided phone number
    const query = `UPDATE otps SET otp = ? WHERE phone_no = ?`;
    const [result, fields] = await db.query(query, [otp, phone_no]);
    return res.status(200).json({ message: "OTP sent successfully", otp });
  }
  return next(new AppError(404, "User not found"));
});

exports.getUserDetails = asyncChoke(async (req, res, next) => {
  const id = req.user.id;

  try {
    const [userData] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
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
      const [email_exist] = await db.query(
        "SELECT * FROM users WHERE email = ? AND id != ?",
        [email, id]
      );
      if (email_exist.length > 0) {
        return next(new AppError(401, "User with this email already exists"));
      }
      const [phone_exist] = await db.query(
        "SELECT * FROM users WHERE phone_no = ? AND id != ?",
        [phone_no, id]
      );
      if (phone_exist.length > 0) {
        return next(
          new AppError(401, "User with this phone_no already exists")
        );
      }
      const [otpPhoneExist] = await db.query(
        "SELECT * FROM otps WHERE phone_no = ?",
        [phone_no]
      );
      if (otpPhoneExist.length === 0) {
        const [otpSender] = await db.query(
          "INSERT INTO otps (phone_no, otp) VALUES (?, ?);",
          [phone_no, otp]
        );
      } else {
        const [updateOtps] = await db.query(
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
      const [email_exist] = await db.query(
        "SELECT * FROM users WHERE email = ? AND id != ?",
        [email, id]
      );
      if (email_exist.length > 0) {
        return next(new AppError(401, "User with this email already exists"));
      }
      const [phone_exist] = await db.query(
        "SELECT * FROM users WHERE phone_no = ? AND id != ?",
        [phone_no, id]
      );
      if (phone_exist.length > 0) {
        return next(
          new AppError(401, "User with this phone_no already exists")
        );
      }
      const checkOTPQuery = `SELECT COUNT(*) AS otp_matched FROM otps WHERE phone_no = ? AND otp = ?`;
      const [otpResult] = await db.query(checkOTPQuery, [phone_no, givenOTP]);

      if (otpResult[0].otp_matched === 0) {
        return next(new AppError(401, "Invalid OTP"));
      }
      const [updateUser] = await db.query(
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
    const [userAddress] = await db.query(
      "INSERT INTO userAddress (user_id, state, city, area, house_no, lat, lon, type, R_name, R_phone_no) VALUES(?,?,?,?,?,?,?,?,?,?)",
      [id, state, city, area, house_no, lat, lon, type, R_name, R_phone_no]
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
    const [Addresses] = await db.query(
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


exports.removeAddress = asyncChoke(async(req, res, next)=>{
    const id = req.user.id;
    const {address_id} = req.params;
    try{
        const [addressRemoval] = await db.query('DELETE FROM userAddress WHERE user_id = ? AND id = ? ', [id,address_id]);
        if(addressRemoval.affectedRows === 0){
            return next(new AppError(400, "Error: Cannot remove address!"));
        }
        return res.status(200).json({
            status:"success",
            message:"Address Removed!"
        });
    }catch(err){
        return next(new AppError(500, "Internal Server Got An Error", err));
    }
});

exports.editAddress = asyncChoke(async(req, res, next)=>{
    const id = req.user.id;
    const {address_id} = req.params;
    const validTypes = ["home", "office"];
    const { state, city, area, house_no, lat, lon, type, R_name, R_phone_no } = req.body;
    try{
        if ((state && city && area && house_no && lat && lon && type) === "") {
            return next(new AppError(401, "Provide all required details!"));
          }
    
          if (!validTypes.includes(type)) {
            return next(new AppError(400, `Type cannot be ${type}`));
          }
          const [userAddress] = await db.query(
            "UPDATE userAddress SET state = ?, city = ?, area = ?, house_no = ?, lat = ?, lon = ?, type = ?, R_name = ?, R_phone_no = ? WHERE user_id = ? AND id = ?",
            [state, city, area, house_no, lat, lon, type, R_name, R_phone_no, id, address_id]
        );
        if (userAddress.affectedRows === 0) {
            return next(new AppError(404, "Address not found or no changes made."));
        }
          return res.status(200).json({
            status: "Success",
            message: "Address Updated!",
          });
    }catch(err){
        return next(new AppError(500, "Internal Server Got An Error", err));
    }
})
