const jwt = require("jsonwebtoken");
const { pool } = require("../Config/database");

exports.socketAuth = async (socket, next) => {
  const token = socket.handshake.query.token;

  if (!token) {
    const err = new Error("not authorized");
    err.data = { content: "Please login" };
    throw err;
  }

  try {
    const { data, role } = jwt.verify(token, process.env.JWT_SECRET);

    let query = "";
    let result;

    if (role === "user") {
      query = `SELECT * FROM users WHERE phone_no = ?`;
      [result] = await pool.query(query, [data]);
    } else if (role === "seller") {
      query = `SELECT * FROM restaurants WHERE owner_phone_no = ?`;
      [result] = await pool.query(query, [data]);
    } else if (role === "delivery_boy") {
      query = `SELECT * FROM delivery_boys WHERE phone_no = ?`;
      [result] = await pool.query(query, [data]);
    } else {
      return next(new AppError(401, "Invalid role provided in the token."));
    }

    if (result.length === 0) {
      throw new Error("Invalid Token");
    }

    socket.user = result[0];

    next();
  } catch (err) {
    socket.emit("error", "ERROR connection");
    next(err);
  }
};
