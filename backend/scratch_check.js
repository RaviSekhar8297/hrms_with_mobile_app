const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function check() {
  try {
    const emp1027 = await pool.query("SELECT id, emp_id_code, first_name, last_name, email, company_id, reporting_to_id FROM hrms.employees WHERE emp_id_code = '1027'");
    const emp1413 = await pool.query("SELECT id, emp_id_code, first_name, last_name, email, company_id, reporting_to_id FROM hrms.employees WHERE emp_id_code = '1413'");
    console.log('Manager 1027:', emp1027.rows);
    console.log('Employee 1413:', emp1413.rows);

    if (emp1027.rows.length > 0 && emp1413.rows.length > 0) {
      const managerId = emp1027.rows[0].id;
      if (emp1413.rows[0].reporting_to_id !== managerId) {
        console.log('Updating 1413 reporting_to_id to 1027...');
        await pool.query("UPDATE hrms.employees SET reporting_to_id = $1 WHERE emp_id_code = '1413'", [managerId]);
        console.log('Updated 1413 reporting_to_id to:', managerId);
      } else {
        console.log('1413 is ALREADY reporting to 1027!');
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
