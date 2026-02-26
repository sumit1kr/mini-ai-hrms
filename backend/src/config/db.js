const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Check if DATABASE_URL is available, otherwise use individual credentials
let poolConfig;

if (process.env.DATABASE_URL) {
  // Use connection string (Render internal Postgres)
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
  console.log('Using DATABASE_URL connection string');
} else {
  // Use individual credentials (local PostgreSQL)
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'hrms_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
  console.log(`Using individual credentials: ${poolConfig.user}@${poolConfig.host}:${poolConfig.port}/${poolConfig.database}`);
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

/**
 * Execute a query with optional parameters
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 */
const query = (text, params) => pool.query(text, params);

/**
 * Get a client from the pool for transactions
 */
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };