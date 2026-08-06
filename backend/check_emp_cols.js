const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkEmpColumns() {
  try {
    const cols = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'hrms' AND table_name = 'employees'
    `);
    console.log('✅ EMPLOYEES COLUMNS IN SUPABASE:', cols.rows.map(c => c.column_name));
  } catch (err) {
    console.error('❌ ERROR:', err);
  } finally {
    await pool.end();
  }
}

checkEmpColumns();
