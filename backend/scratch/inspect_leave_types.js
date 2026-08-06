const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres?schema=hrms';

async function testQuery() {
  const client = new Client({
    connectionString: connectionString,
  });

  try {
    await client.connect();
    console.log('Connected to database successfully!');

    console.log('Querying table information for hrms.leave_types...');
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_schema = 'hrms' AND table_name = 'leave_types';
    `);
    
    console.log('Columns in hrms.leave_types:');
    result.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default})`);
    });
  } catch (error) {
    console.error('Query failed with error:', error.message);
  } finally {
    await client.end();
  }
}

testQuery();
