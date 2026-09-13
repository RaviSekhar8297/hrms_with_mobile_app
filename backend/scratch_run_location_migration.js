const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('🔌 Connected to PostgreSQL/Supabase DB successfully.');

    const sqlPath = path.join(__dirname, '../database/05_attendance_location_tracking.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📜 Executing SQL Migration for hrms.attendance_location_tracking...');
    await client.query(sql);

    console.log('✅ [SUCCESS] Table hrms.attendance_location_tracking and Indexes created successfully in DB!');
  } catch (err) {
    console.error('❌ Migration Execution Error:', err);
  } finally {
    await client.end();
  }
}

runMigration();
