const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres?schema=hrms';
  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    const sqlPath = path.join(__dirname, '../database/02_recruitment_schema.sql');
    const sqlScript = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing SQL script...');
    await client.query(sqlScript);
    
    console.log('SQL script executed successfully! All 16 tables created.');
  } catch (error) {
    console.error('Error executing SQL script:', error);
  } finally {
    await client.end();
  }
}

runMigration();
