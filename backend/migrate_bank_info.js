const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres?schema=hrms';

async function runBankMigration() {
  console.log(`Connecting to database to adjust bank columns...`);
  const client = new Client({
    connectionString: connectionString,
  });

  try {
    await client.connect();
    console.log('Connected to database successfully!');

    // 1. Drop old individual bank columns and add bank_information JSONB column
    const adjustQuery = `
      ALTER TABLE hrms.employees 
      DROP COLUMN IF EXISTS bank_name,
      DROP COLUMN IF EXISTS bank_account_no,
      DROP COLUMN IF EXISTS ifsc_code;

      ALTER TABLE hrms.employees
      ADD COLUMN IF NOT EXISTS bank_information JSONB DEFAULT '[]'::jsonb;
    `;

    console.log('Dropping individual bank columns and adding bank_information JSONB...');
    await client.query(adjustQuery);
    console.log('Database table hrms.employees updated successfully!');

    console.log('\n✅ Bank columns migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration Failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await client.end();
  }
}

runBankMigration();
