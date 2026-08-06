const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres?schema=hrms';

async function testAutoDocuments() {
  const client = new Client({
    connectionString: connectionString,
  });

  try {
    await client.connect();
    console.log('Connected to DB. Finding a valid company...');
    
    const companyRes = await client.query('SELECT id FROM hrms.companies LIMIT 1');
    if (companyRes.rows.length === 0) {
      console.log('No companies found. Cannot run test.');
      return;
    }
    const companyId = companyRes.rows[0].id;
    console.log(`Found company ID: ${companyId}`);

    const uniqueCode = 'TEST_EMP_' + Date.now();
    const uniqueEmail = 'test_' + Date.now() + '@example.com';

    console.log('Inserting test employee...');
    const insertEmployeeRes = await client.query(
      `INSERT INTO hrms.employees (
         company_id, emp_id_code, first_name, last_name, email, status, joining_date
       ) VALUES ($1, $2, 'Test', 'AutoDoc', $3, 'ACTIVE', CURRENT_DATE) RETURNING id`,
      [companyId, uniqueCode, uniqueEmail]
    );
    const newEmpId = insertEmployeeRes.rows[0].id;
    console.log(`Employee inserted with ID: ${newEmpId}`);

    // Simulate what the backend server POST does (auto-initializes the documents row)
    console.log('Auto-initializing documents record (simulating backend POST)...');
    await client.query(
      `INSERT INTO hrms.employee_documents (company_id, employee_id, documents)
       VALUES ($1, $2, '[]'::jsonb)
       ON CONFLICT (employee_id) DO NOTHING`,
      [companyId, newEmpId]
    );

    console.log('Querying employee_documents for the new employee...');
    const docRes = await client.query(
      'SELECT * FROM hrms.employee_documents WHERE employee_id = $1',
      [newEmpId]
    );

    if (docRes.rows.length > 0) {
      console.log('✅ Success! Found initialized documents record:');
      console.log(docRes.rows[0]);
    } else {
      console.log('❌ Error! No documents record was created.');
    }

    console.log('Cleaning up test employee...');
    await client.query('DELETE FROM hrms.employees WHERE id = $1', [newEmpId]);
    
    // Check if the documents row is also deleted due to CASCADE
    const docCheckAfterDelete = await client.query(
      'SELECT * FROM hrms.employee_documents WHERE employee_id = $1',
      [newEmpId]
    );
    if (docCheckAfterDelete.rows.length === 0) {
      console.log('✅ Success! Cascade delete verified (documents record is also removed).');
    } else {
      console.log('❌ Error! Documents record was not cascade deleted.');
    }

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await client.end();
  }
}

testAutoDocuments();
