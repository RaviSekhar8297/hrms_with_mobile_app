const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runEventsMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is missing in environment variables.');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL successfully.');

    const sqlPath = path.join(__dirname, '../database/04_employee_events_schema.sql');
    const sqlScript = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing employee_events SQL script...');
    await client.query(sqlScript);

    console.log('Migration SUCCESS: employee_events, event_wishes, and event_reactions tables created!');
  } catch (error) {
    console.error('Error executing SQL script:', error);
  } finally {
    await client.end();
  }
}

runEventsMigration();
