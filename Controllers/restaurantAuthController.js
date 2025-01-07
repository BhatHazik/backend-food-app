const jwt = require("jsonwebtoken");
const { pool } = require("../Config/database");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
exports.protect = asyncChoke(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(
      new AppError(401, "You are not logged in! Please log in to get access.")
    );
  }

  try {
    const { data, role } = jwt.verify(token, process.env.JWT_SECRET);
    if (role !== "seller") {
      return next(
        new AppError(401, "You are not authorized to access this route!")
      );
    }

    const query = `SELECT * FROM restaurants WHERE owner_phone_no = ?`;
    const [result] = await pool.query(query, [data]);

    if (result.length === 0) {
      return next(
        new AppError(
          401,
          "The user belonging to this token does no longer exist."
        )
      );
    }

    req.user = result[0];
    next();
  } catch (error) {
    next(new AppError(401, "Invalid token. Please log in again!"));
  }
});
