const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres?schema=hrms';

async function runMigration() {
  console.log(`Connecting to database...`);
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected!');

    await client.query(`
      ALTER TABLE hrms.companies 
      ADD COLUMN IF NOT EXISTS established_date DATE;
    `);
    console.log('hrms.companies altered successfully! Added established_date column.');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await client.end();
  }
}

runMigration();
