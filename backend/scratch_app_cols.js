const { Client } = require('pg');
require('dotenv').config();

async function checkAppCols() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
  const client = new Client({ connectionString });

  try {
    await client.connect();

    const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'hrms' AND table_name = 'job_applications'
    `);
    console.log('job_applications cols:', cols.rows);

    const rows = await client.query(`SELECT * FROM hrms.job_applications LIMIT 5`);
    console.log('job_applications rows:', rows.rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkAppCols();
