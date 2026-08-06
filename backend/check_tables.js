const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkTables() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'hrms' 
        AND (table_name LIKE '%payroll%' OR table_name LIKE '%payslip%' OR table_name LIKE '%assignment%')
    `);
    console.log('✅ SUPABASE HRMS ENTERPRISE PAYROLL TABLES VERIFIED:', res.rows.map(r => r.table_name));
    
    // Check columns of payroll_runs
    const cols = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'hrms' AND table_name = 'payroll_runs'
    `);
    console.log('✅ PAYROLL_RUNS COLUMNS IN SUPABASE:', cols.rows.map(c => c.column_name));
  } catch (err) {
    console.error('❌ ERROR CHECKING DB:', err);
  } finally {
    await pool.end();
  }
}

checkTables();
