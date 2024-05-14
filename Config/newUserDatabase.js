const mysql = require("mysql2/promise");
const { asyncChoke } = require("./Utils/asyncWrapper.js");

exports.createDB = asyncChoke(async (dbName) => {
  const pool = mysql.createPool({
    host: process.env.HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: null,
  });

  await pool.query(`CREATE DATABASE ${dbName.split("@")[0]}`);
  pool.end();
});
