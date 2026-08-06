const { Client } = require('pg');
require('dotenv').config();

async function seedInterviewData() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
  const client = new Client({ connectionString });

  try {
    await client.connect();

    const companyRes = await client.query(`SELECT id FROM hrms.companies LIMIT 1`);
    const companyId = companyRes.rows[0]?.id;

    const appsRes = await client.query(`
      SELECT ja.id as app_id, ja.candidate_id, c.first_name, c.last_name 
      FROM hrms.job_applications ja 
      JOIN hrms.candidates c ON c.id = ja.candidate_id
    `);

    const app1 = appsRes.rows[0]; // Ravi Sekhar
    const app2 = appsRes.rows[1] || appsRes.rows[0]; // Sam Sundhar

    const roundRes = await client.query(`SELECT id FROM hrms.job_interview_rounds LIMIT 2`);
    const round1 = roundRes.rows[0]?.id;
    const round2 = roundRes.rows[1]?.id || round1;

    const existingCount = await client.query(`SELECT count(*) FROM hrms.interview_schedules`);
    if (parseInt(existingCount.rows[0].count) < 4) {
      const now = new Date();

      const t1 = new Date(now);
      t1.setHours(14, 30, 0, 0);

      const t2 = new Date(now);
      t2.setHours(16, 0, 0, 0);

      const t3 = new Date(now);
      t3.setDate(t3.getDate() + 1);
      t3.setHours(11, 0, 0, 0);

      await client.query(`
        INSERT INTO hrms.interview_schedules 
        (company_id, application_id, job_interview_round_id, interview_mode, meeting_link, scheduled_start_time, scheduled_end_time, status)
        VALUES 
        ($1, $2, $3, 'Online Google Meet', 'https://meet.google.com/abc-defg-hij', $4, $4, 'SCHEDULED'),
        ($1, $5, $6, 'In-Person Office', 'Conference Room 3B', $7, $7, 'SCHEDULED'),
        ($1, $2, $3, 'Online Zoom', 'https://zoom.us/j/987654321', $8, $8, 'SCHEDULED')
      `, [companyId, app1.app_id, round1, t1, app2.app_id, round2, t2, t3]);

      console.log('Inserted sample interview schedules successfully.');
    }

  } catch (err) {
    console.error('Error seeding interview data:', err.message);
  } finally {
    await client.end();
  }
}

seedInterviewData();
