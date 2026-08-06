const { Client } = require('pg');
require('dotenv').config();

async function checkApps() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
  const client = new Client({ connectionString });

  try {
    await client.connect();

    const apps = await client.query(`
      SELECT 
        ja.id as app_id,
        ja.candidate_id,
        ja.job_id,
        c.first_name,
        c.last_name,
        c.email as candidate_email,
        c.phone as candidate_phone,
        jp.title as job_title
      FROM hrms.job_applications ja
      LEFT JOIN hrms.candidates c ON c.id = ja.candidate_id
      LEFT JOIN hrms.job_postings jp ON jp.id = ja.job_id
    `);
    console.log('Applications:', apps.rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkApps();
