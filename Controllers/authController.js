const jwt = require('jsonwebtoken');
const db = require('../Config/database');
exports.protect = async(req, res, next) =>{
    let token
    if(req.headers.authorization && req.headers.authorization.startsWith("Bearer")){
      token = req.headers.authorization.split(" ")[1]
    }
    const {data} = jwt.verify(token, process.env.JWT_SECRET);
    const query = `SELECT * FROM users WHERE phone_no = ?`
    const value = [data];
    const [result] = await db.query(query, value);
    
    req.user = result[0];
    
    next();
}