const { Client } = require('pg');
require('dotenv').config();

async function testJoinQuery() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
  const client = new Client({ connectionString });

  try {
    await client.connect();

    const res = await client.query(`
      SELECT 
        ins.id,
        ins.company_id,
        ins.application_id,
        ins.interview_mode,
        ins.meeting_link,
        ins.location,
        ins.scheduled_start_time,
        ins.scheduled_end_time,
        ins.status,
        ins.created_at,
        c.id as candidate_id,
        c.first_name || ' ' || c.last_name as candidate_name,
        c.email as candidate_email,
        c.phone as candidate_phone,
        jp.title as job_title,
        ir.round_name
      FROM hrms.interview_schedules ins
      LEFT JOIN hrms.job_applications ja ON ja.id = ins.application_id
      LEFT JOIN hrms.candidates c ON c.id = ja.candidate_id
      LEFT JOIN hrms.job_postings jp ON jp.id = ja.job_posting_id
      LEFT JOIN hrms.job_interview_rounds ir ON ir.id = ins.job_interview_round_id
    `);

    console.log('Joined Interview Schedules:', res.rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

testJoinQuery();
