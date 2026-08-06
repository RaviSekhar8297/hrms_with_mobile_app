const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function check() {
  try {
    const res = await pool.query(`
      SELECT p.id, p.name, p.module 
      FROM hrms.role_permissions rp 
      JOIN hrms.permissions p ON rp.permission_id = p.id 
      WHERE rp.role_id = 'ee31cc6d-9d17-41c4-87c3-ed8e5c06d6d7'
    `);
    console.log('Manager Role Permissions:', res.rows.map(r => r.name));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
