const jwt = require("jsonwebtoken");
const {pool} = require("../Config/database"); // Import your database pool

// Define the socket authentication middleware
exports.socketAuth = async (socket, next) => {
  const token = socket.handshake.query.token;


  if (!token) {
    const err = new Error("not authorized");
    err.data = { content: "Please login" };
    throw err;
  }

  try {
    // Verify the token
    const { data, role } = jwt.verify(token, process.env.JWT_SECRET);

    let query = '';
    let result;

    // Based on the role, query the appropriate table
    if (role === 'user') {
      query = `SELECT * FROM users WHERE phone_no = ?`;
      [result] = await pool.query(query, [data]);

    } else if (role === 'seller') {
      query = `SELECT * FROM restaurants WHERE owner_phone_no = ?`; // Or any unique field for restaurant
      [result] = await pool.query(query, [data]);

    } else if (role === 'delivery_boy') {
      query = `SELECT * FROM delivery_boys WHERE phone_no = ?`; // Or any unique field for delivery boy
      [result] = await pool.query(query, [data]);

    } else {
      return next(new AppError(401, "Invalid role provided in the token."));
    }

    // If no user, restaurant, or delivery boy is found, deny access
    if (result.length === 0) {
      throw new Error("Invalid Token");
    }

    // Attach the user/restaurant/delivery_boy data to the socket object
    socket.user = result[0];

    // Continue to the next middleware (connection is authenticated)
    next();
    
  } catch (err) {
    socket.emit("error", "ERROR connection");
    next(err);
  }
};
