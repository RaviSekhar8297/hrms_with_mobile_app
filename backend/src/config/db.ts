import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

let dbHost = 'unknown';
let dbPort = '5432';
try {
  const parsed = new URL(connectionString);
  dbHost = parsed.hostname;
  dbPort = parsed.port || '5432';
} catch {
  console.error('DATABASE_URL is not a valid connection string');
}

const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10,
  ssl: false,
});

pool.on('connect', () => {
  console.log(`Connected to Supabase PostgreSQL database. host=${dbHost} port=${dbPort}`);
});

pool.on('error', (err) => {
  console.error(`Unexpected error on database idle client (host=${dbHost} port=${dbPort}):`, err.message);
});

export const query = (text: string, params?: unknown[]) => pool.query(text, params);
export default pool;
