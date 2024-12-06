const jwt = require("jsonwebtoken");



exports.socketAuth = async (socket, next) => {
  
    const token = socket.handshake.query.token;
    if (!token) {
        return next(new AppError(401, "You are not logged in! Please log in to get access."));
      }
    
      try {
        const { data } = jwt.verify(token, process.env.JWT_SECRET);
    
        const query = `SELECT * FROM users WHERE phone_no = ?`;
        const [result] = await pool.query(query, [data]);
    
        if (result.length === 0) {
          return next(new AppError(401, "The user belonging to this token does no longer exist."));
        }
    
        socket.user = result[0];
        
        next();
  } catch (err) {
    socket.emit("error", "ERROR connection");
    next(err);
  }
};
