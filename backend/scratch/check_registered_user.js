const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres?schema=hrms';

async function checkDatabase() {
  const client = new Client({
    connectionString: connectionString,
  });

  try {
    await client.connect();
    
    console.log('Querying hrms.employees...');
    const empRes = await client.query("SELECT * FROM hrms.employees WHERE email LIKE 'testkeycloak%'");
    console.log(`Found ${empRes.rows.length} test employee(s):`);
    console.log(empRes.rows);

    for (const emp of empRes.rows) {
      console.log(`\nQuerying hrms.employee_documents for employee ID: ${emp.id}`);
      const docRes = await client.query("SELECT * FROM hrms.employee_documents WHERE employee_id = $1", [emp.id]);
      console.log(docRes.rows);
    }

  } catch (err) {
    console.error('Database query failed:', err);
  } finally {
    await client.end();
  }
}

checkDatabase();
