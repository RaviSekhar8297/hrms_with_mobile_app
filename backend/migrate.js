const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres?schema=hrms';

async function runMigration() {
  console.log(`Connecting to database to run migration...`);
  console.log(`DB URL: ${connectionString.replace(/:[^:@/]+@/, ':****@')}`); // Hide password in logs

  const client = new Client({
    connectionString: connectionString,
  });

  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL database successfully!');

    // Read the schema.sql file
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`schema.sql not found at: ${schemaPath}`);
    }

    const sql = fs.readFileSync(schemaPath, 'utf8');
    console.log('Running migration queries in schema.sql...');

    // Run the migration script
    await client.query(sql);

    console.log('\n✅ Database Schema Migrated Successfully!');
    console.log('Tables, schemas, indices, and constraints are now active.');
  } catch (error) {
    console.error('\n❌ Migration Failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await client.end();
  }
}

runMigration();
