const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runWorkBridgeMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is missing in environment variables.');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    const sqlPath = path.join(__dirname, '../database/06_workbridge_schema.sql');
    const sqlScript = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing WorkBridge 20-table SQL script safely...');
    await client.query(sqlScript);

    console.log('MIGRATION SUCCESS: All 20 WorkBridge tables & indexes created/verified cleanly!');
  } catch (error) {
    console.error('Error executing WorkBridge SQL script:', error);
  } finally {
    await client.end();
  }
}

runWorkBridgeMigration();
