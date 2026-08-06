const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    const emp1413Res = await pool.query("SELECT id, company_id FROM hrms.employees WHERE emp_id_code = '1413'");
    const emp1413 = emp1413Res.rows[0];

    // Try LATE_ARRIVALS
    const permRes = await pool.query(
      `INSERT INTO hrms.permission_requests (company_id, employee_id, permission_type, permission_date, from_time, to_time, duration_minutes, reason, status)
       VALUES ($1, $2, 'LATE_ARRIVALS', CURRENT_DATE, '10:00:00', '12:00:00', 120, 'Late Arrivals Permission Test for prasuna', 'PENDING')
       RETURNING id`,
      [emp1413.company_id, emp1413.id]
    );
    console.log('Created Permission Request ID:', permRes.rows[0].id);

    // 3. Create Regularization Request
    const regRes = await pool.query(
      `INSERT INTO hrms.attendance_regularizations (employee_id, attendance_date, requested_in, requested_out, reason, status)
       VALUES ($1, CURRENT_DATE - INTERVAL '1 day', '09:30:00', '18:30:00', 'Biometric punch missed regularization test for prasuna', 'PENDING')
       ON CONFLICT (employee_id, attendance_date) DO UPDATE SET status = 'PENDING'
       RETURNING id`,
      [emp1413.id]
    );
    console.log('Created Attendance Regularization Request ID:', regRes.rows[0].id);

  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
