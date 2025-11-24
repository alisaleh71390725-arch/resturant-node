const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: 1433, 
  options: {
    encrypt: true, 

    trustServerCertificate: true,
  },
};

module.exports = { sql, config };
