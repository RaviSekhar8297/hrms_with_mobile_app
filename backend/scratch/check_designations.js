const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  try {
    const res = await client.query(`
      SELECT e.email, e.designation_id, des.name as designation_name
      FROM hrms.employees e
      LEFT JOIN hrms.designations des ON e.designation_id = des.id
    `);
    console.log("Employees and their designations:");
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
