const { Client } = require('pg');
require('dotenv').config();

async function testQuery() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const companyId = 'aba6cb1b-1487-437e-8949-f846cfc48a14';
  const today = new Date();
  const currentYear = today.getFullYear();
  const pad = (n) => String(n).padStart(2, '0');
  const mmdd = `${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const todayDateStr = `${currentYear}-${mmdd}`;

  await client.query(
    `INSERT INTO hrms.employee_events (company_id, employee_id, event_type, event_date, event_year)
     SELECT company_id, id, 'BIRTHDAY', $3, $4
     FROM hrms.employees
     WHERE company_id = $1 AND status = 'ACTIVE' AND dob IS NOT NULL AND TO_CHAR(dob, 'MM-DD') = $2
     ON CONFLICT (company_id, employee_id, event_type, event_year) DO NOTHING`,
    [companyId, mmdd, todayDateStr, currentYear]
  );

  const events = await client.query(
    `SELECT ee.id, ee.event_type, ee.event_date, emp.first_name, emp.last_name 
     FROM hrms.employee_events ee 
     JOIN hrms.employees emp ON emp.id = ee.employee_id 
     WHERE ee.company_id = $1 AND ee.event_date = $2`,
    [companyId, todayDateStr]
  );

  console.log('Today events in DB:', events.rows);
  await client.end();
}

testQuery();
