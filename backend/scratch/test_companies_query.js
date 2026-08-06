const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres?schema=hrms';

async function testQuery() {
  const client = new Client({
    connectionString: connectionString,
  });

  try {
    await client.connect();
    console.log('Connected to database successfully!');

    console.log('Running ALTER TABLE to add domain column...');
    await client.query('ALTER TABLE hrms.companies ADD COLUMN IF NOT EXISTS domain VARCHAR(255);');
    console.log('ALTER TABLE succeeded!');

    console.log('Running test query: SELECT id, name, subdomain, domain, branding_logo, status, created_at FROM hrms.companies ORDER BY name ASC');
    const result = await client.query('SELECT id, name, subdomain, domain, branding_logo, status, created_at FROM hrms.companies ORDER BY name ASC');
    console.log('Query succeeded! Total companies:', result.rows.length);
    console.log('Row sample:', result.rows);
  } catch (error) {
    console.error('Query failed with error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await client.end();
  }
}

testQuery();
