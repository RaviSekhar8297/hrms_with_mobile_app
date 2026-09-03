"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = void 0;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
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
}
catch {
    console.error('DATABASE_URL is not a valid connection string');
}
const pool = new pg_1.Pool({
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
const query = (text, params) => pool.query(text, params);
exports.query = query;
exports.default = pool;
