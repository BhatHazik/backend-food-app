const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'database-1.cpeiswscsyaj.ap-south-1.rds.amazonaws.com',
  user: 'admin',
  password: "hazik123",
  database: 'swiggy',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool.promise();

