const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres?schema=hrms';

async function runAlterMigration() {
  console.log(`Connecting to database to run alter migrations...`);
  const client = new Client({
    connectionString: connectionString,
  });

  try {
    await client.connect();
    console.log('Connected to database successfully!');

    // 1. Alter employees table to add the new columns
    const alterQuery = `
      ALTER TABLE hrms.employees 
      ADD COLUMN IF NOT EXISTS dob DATE,
      ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
      ADD COLUMN IF NOT EXISTS marital_status VARCHAR(50),
      ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10),
      ADD COLUMN IF NOT EXISTS personal_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS reporting_to_id UUID REFERENCES hrms.employees(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS probation_period_months INTEGER,
      ADD COLUMN IF NOT EXISTS confirmation_date DATE,
      ADD COLUMN IF NOT EXISTS exit_date DATE,
      ADD COLUMN IF NOT EXISTS resignation_date DATE,
      ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS bank_account_no VARCHAR(100),
      ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS pan_number VARCHAR(50),
      ADD COLUMN IF NOT EXISTS aadhar_number VARCHAR(50),
      ADD COLUMN IF NOT EXISTS esi_number VARCHAR(50),
      ADD COLUMN IF NOT EXISTS uan_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS current_address TEXT,
      ADD COLUMN IF NOT EXISTS permanent_address TEXT,
      ADD COLUMN IF NOT EXISTS emergency_contacts JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS education JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS experience JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb;
    `;

    console.log('Running ALTER TABLE statements on hrms.employees...');
    await client.query(alterQuery);
    console.log('hrms.employees table altered successfully!');

    // 2. Create employee_documents table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS hrms.employee_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES hrms.companies(id) ON DELETE CASCADE,
        employee_id UUID REFERENCES hrms.employees(id) ON DELETE CASCADE UNIQUE,
        documents JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    console.log('Running CREATE TABLE for hrms.employee_documents...');
    await client.query(createTableQuery);
    console.log('hrms.employee_documents table created successfully!');

    // 3. Add index on employee_documents table
    const indexQuery = `
      CREATE INDEX IF NOT EXISTS idx_employee_documents_emp ON hrms.employee_documents(employee_id);
    `;
    await client.query(indexQuery);
    console.log('Index created on hrms.employee_documents successfully!');

    console.log('\n✅ Database alterations applied successfully!');
  } catch (error) {
    console.error('\n❌ Migration Failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await client.end();
  }
}

runAlterMigration();
