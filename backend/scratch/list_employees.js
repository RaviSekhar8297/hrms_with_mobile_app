const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const res = await pool.query('SELECT emp_id_code, email, status FROM hrms.employees');
  console.log('Employees:', res.rows);
  pool.end();
}
run();
