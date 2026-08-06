const { Client } = require('pg');
require('dotenv').config();

async function seedOnboarding() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
  const client = new Client({ connectionString });

  try {
    await client.connect();

    const companyRes = await client.query(`SELECT id FROM hrms.companies LIMIT 1`);
    const companyId = companyRes.rows[0]?.id;

    const candidates = await client.query(`SELECT c.id as candidate_id, c.first_name, c.last_name, c.email, ja.id as app_id FROM hrms.candidates c LEFT JOIN hrms.job_applications ja ON ja.candidate_id = c.id LIMIT 2`);
    
    if (candidates.rows.length === 0) {
      console.log('No candidates found to seed onboarding.');
      return;
    }

    const c1 = candidates.rows[0];
    const c2 = candidates.rows[1] || candidates.rows[0];

    const count = await client.query(`SELECT count(*) FROM hrms.employee_onboardings`);
    if (parseInt(count.rows[0].count) === 0) {
      const now = new Date();
      const target1 = new Date(now); target1.setDate(target1.getDate() + 5);
      const target2 = new Date(now); target2.setDate(target2.getDate() + 10);

      await client.query(`
        INSERT INTO hrms.employee_onboardings
        (company_id, onboarding_code, candidate_id, application_id, portal_token, onboarding_status, target_joining_date, candidate_submitted_data, document_verification_status, checklist_status)
        VALUES
        (
          $1, 'ONB-2026-001', $2, $3, 'tok_demo_ravisekhar_98765', 'DOCS_SUBMITTED', $4,
          '{"bank_information":[{"bank_name":"HDFC Bank","account_number":"50100492817291","ifsc_code":"HDFC0001234","branch_name":"Madhapur"}],"emergency_contacts":[{"name":"Venkatesh","relationship":"Father","phone":"9848022338"}],"pan_number":"ABCDE1234F","aadhar_number":"987654321098","current_address":"Plot 42, Hitech City, Hyderabad"}',
          '{"pan":"VERIFIED","aadhar":"VERIFIED","degree":"PENDING"}',
          '{"laptop_assigned":true,"email_created":true,"nda_signed":true,"biometric_registered":false}'
        ),
        (
          $1, 'ONB-2026-002', $5, $3, 'tok_demo_samsundhar_12345', 'LINK_SENT', $6,
          '{}',
          '{}',
          '{"laptop_assigned":false,"email_created":false,"nda_signed":false,"biometric_registered":false}'
        )
      `, [companyId, c1.candidate_id, c1.app_id, target1, c2.candidate_id, target2]);

      console.log('Successfully seeded sample onboarding records!');
    } else {
      console.log('Onboarding records already exist.');
    }

  } catch (err) {
    console.error('Error seeding onboarding:', err.message);
  } finally {
    await client.end();
  }
}

seedOnboarding();
