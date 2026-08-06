const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres?schema=hrms';

async function checkLogs() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const res = await client.query('SELECT * FROM hrms.activity_logs ORDER BY created_at DESC LIMIT 5');
    console.log('\n--- LATEST ACTIVITY LOGS ---');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error checking logs:', err);
  } finally {
    await client.end();
  }
}

checkLogs();
