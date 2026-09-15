const { Client } = require('pg');
require('dotenv').config();

async function checkCompaniesAndLabels() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    
    console.log('--- COMPANIES ---');
    const compRes = await client.query(`SELECT id, name FROM hrms.companies`);
    console.log(compRes.rows);

    console.log('--- TASK LABELS COUNT BY COMPANY ---');
    const labelRes = await client.query(
      `SELECT company_id, COUNT(*) as count FROM hrms.task_labels GROUP BY company_id`
    );
    console.log(labelRes.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

checkCompaniesAndLabels();
