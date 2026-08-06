const { Client } = require('pg');
require('dotenv').config();

async function getRounds() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
  const client = new Client({ connectionString });

  try {
    await client.connect();

    const rounds = await client.query(`SELECT id, round_name FROM hrms.job_interview_rounds LIMIT 5`);
    console.log('Rounds:', rounds.rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

getRounds();
