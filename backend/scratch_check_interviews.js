const { Client } = require('pg');
require('dotenv').config();

async function checkInterviews() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
  const client = new Client({ connectionString });

  try {
    await client.connect();

    const schedules = await client.query(`SELECT * FROM hrms.interview_schedules`);
    console.log('Schedules count:', schedules.rows.length);
    console.log('Schedules:', schedules.rows);

    const candidates = await client.query(`SELECT id, first_name, last_name, email FROM hrms.candidates`);
    console.log('Candidates count:', candidates.rows.length);
    console.log('Candidates:', candidates.rows);

    const feedback = await client.query(`SELECT * FROM hrms.interview_feedback`);
    console.log('Feedback count:', feedback.rows.length);
    console.log('Feedback:', feedback.rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkInterviews();
