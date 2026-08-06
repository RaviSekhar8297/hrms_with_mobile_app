const { Client } = require('pg');
require('dotenv').config();

async function inspectFullSummary() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
  const client = new Client({ connectionString });

  try {
    await client.connect();

    const res = await client.query(`
      SELECT 
        table_schema,
        table_name,
        count(column_name) as col_count
      FROM information_schema.columns
      WHERE table_schema IN ('hrms', 'public', 'auth', 'storage', 'vault')
      GROUP BY table_schema, table_name
      ORDER BY table_schema, table_name;
    `);

    const grouped = {};
    res.rows.forEach(r => {
      if (!grouped[r.table_schema]) grouped[r.table_schema] = [];
      grouped[r.table_schema].push({ table: r.table_name, count: r.col_count });
    });

    console.log(JSON.stringify(grouped, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

inspectFullSummary();
