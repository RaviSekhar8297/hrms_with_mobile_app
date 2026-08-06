const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres?schema=hrms';

async function testQuery() {
  const client = new Client({
    connectionString: connectionString,
  });

  try {
    await client.connect();
    console.log('Testing employee columns...');
    
    // Select one row from employees to see what columns are returned
    const result = await client.query('SELECT * FROM hrms.employees LIMIT 1');
    console.log('Columns in hrms.employees:');
    if (result.fields) {
      const colNames = result.fields.map(f => f.name);
      console.log(colNames.join(', '));
      
      const newColsToCheck = [
        'dob', 'gender', 'marital_status', 'blood_group', 'personal_email', 
        'reporting_to_id', 'employment_type', 'probation_period_months', 
        'confirmation_date', 'exit_date', 'resignation_date', 
        'bank_information', 'pan_number', 
        'aadhar_number', 'esi_number', 'uan_number', 
        'current_address', 'permanent_address', 'emergency_contacts', 
        'education', 'experience', 'skills'
      ];
      
      const missing = newColsToCheck.filter(c => !colNames.includes(c));
      if (missing.length === 0) {
        console.log('✅ All new employee columns (including bank_information JSONB) are present!');
      } else {
        console.log('❌ Missing columns:', missing);
      }
    }
  } catch (err) {
    console.error('Test query failed:', err);
  } finally {
    await client.end();
  }
}

testQuery();
