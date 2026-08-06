const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('Dropping unique constraint unique_job_round_order...');
    await client.query('ALTER TABLE hrms.job_interview_rounds DROP CONSTRAINT IF EXISTS unique_job_round_order;');
    
    console.log('Dropping job_posting_id column...');
    await client.query('ALTER TABLE hrms.job_interview_rounds DROP COLUMN IF EXISTS job_posting_id CASCADE;');
    
    await client.query('COMMIT');
    console.log('Schema update successful!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating schema:', err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
