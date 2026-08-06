const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres?schema=hrms';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to DB');
    await client.query('ALTER TABLE hrms.permission_requests ADD COLUMN IF NOT EXISTS remarks TEXT;');
    console.log('Successfully added remarks column to hrms.permission_requests table.');
  } catch (err) {
    console.error('Error adding remarks:', err);
  } finally {
    await client.end();
  }
}

run();
