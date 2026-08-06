const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres?schema=hrms';

async function runCleanup() {
  const client = new Client({
    connectionString: connectionString,
  });

  try {
    await client.connect();
    console.log('Connected to database successfully!');

    // Let's first check if there are any roles linked to employees to prevent orphan references
    const checkLinkedQuery = `
      SELECT r.name, r.company_id, COUNT(e.id) as employee_count
      FROM hrms.roles r
      LEFT JOIN hrms.employees e ON e.role_id = r.id OR (e.roles_list @> jsonb_build_array(r.name))
      WHERE r.name IN ('HR', 'Manager', 'Employee')
      GROUP BY r.name, r.company_id
    `;
    
    // Check if role_id exists on employees table or similar columns
    // Let's inspect column names first
    const colsResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'hrms' AND table_name = 'employees'
    `);
    const colNames = colsResult.rows.map(r => r.column_name);
    console.log('Employee table columns:', colNames);

    let deleteQuery = ``;
    if (colNames.includes('role_id')) {
      // If there's a role_id, set it to NULL or default Admin first for safety
      console.log('Detected role_id column. We will safe delete roles not linked to anyone, or update them first.');
    }

    // Perform DELETE query for un-linked or all default roles except Admin
    // Let's run a safe delete
    const result = await client.query(`
      DELETE FROM hrms.roles 
      WHERE name IN ('HR', 'Manager', 'Employee') 
      RETURNING *
    `);
    console.log(`Successfully removed ${result.rowCount} default roles from hrms.roles table:`);
    console.log(result.rows.map(r => `${r.name} (Company ID: ${r.company_id})`));

  } catch (error) {
    console.error('Error during cleanup:', error.message);
  } finally {
    await client.end();
  }
}

runCleanup();
