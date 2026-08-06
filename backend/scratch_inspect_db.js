const { Client } = require('pg');
require('dotenv').config();

async function inspectDatabase() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
  const client = new Client({ connectionString });

  try {
    await client.connect();

    const res = await client.query(`
      SELECT 
        table_schema,
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY table_schema, table_name, ordinal_position;
    `);

    const schemaMap = {};
    res.rows.forEach(row => {
      if (!schemaMap[row.table_schema]) schemaMap[row.table_schema] = {};
      if (!schemaMap[row.table_schema][row.table_name]) schemaMap[row.table_schema][row.table_name] = [];
      schemaMap[row.table_schema][row.table_name].push({
        column: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable,
        default: row.column_default
      });
    });

    console.log('=== ALL SCHEMAS SUMMARY ===');
    for (const schemaName of Object.keys(schemaMap)) {
      console.log(`Schema: ${schemaName} (${Object.keys(schemaMap[schemaName]).length} tables)`);
    }

    console.log('\n=== HRMS SCHEMA DETAILS ===');
    if (schemaMap['hrms']) {
      for (const [tbl, cols] of Object.entries(schemaMap['hrms'])) {
        console.log(`\nTable [hrms.${tbl}] (${cols.length} columns):`);
        cols.forEach(c => console.log(`   - ${c.column}: ${c.type} (${c.nullable === 'YES' ? 'NULL' : 'NOT NULL'})`));
      }
    } else {
      console.log('No tables found in hrms schema.');
    }

    console.log('\n=== PUBLIC SCHEMA DETAILS ===');
    if (schemaMap['public']) {
      for (const [tbl, cols] of Object.entries(schemaMap['public'])) {
        console.log(`\nTable [public.${tbl}] (${cols.length} columns):`);
        cols.forEach(c => console.log(`   - ${c.column}: ${c.type} (${c.nullable === 'YES' ? 'NULL' : 'NOT NULL'})`));
      }
    } else {
      console.log('No tables found in public schema.');
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

inspectDatabase();
