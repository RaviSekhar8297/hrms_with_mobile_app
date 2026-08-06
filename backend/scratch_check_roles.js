const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function check() {
  try {
    const res = await pool.query(`
      SELECT e.id, e.emp_id_code, e.first_name, e.last_name, e.email, e.reporting_to_id,
             r.name as role_name, r.id as role_id,
             mgr.emp_id_code as mgr_code, mgr.first_name as mgr_first_name
      FROM hrms.employees e
      LEFT JOIN hrms.roles r ON e.role_id = r.id
      LEFT JOIN hrms.employees mgr ON e.reporting_to_id = mgr.id
      ORDER BY e.emp_id_code ASC
    `);
    console.log('All Employees:', res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
