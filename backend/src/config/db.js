const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Determine SSL configuration
const sslRejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true';
const explicitSslDisabled = process.env.DB_SSL === 'false';
const explicitSslEnabled = process.env.DB_SSL === 'true';

// Check if DATABASE_URL is available, otherwise use individual credentials
let poolConfig;

if (process.env.DATABASE_URL) {
  let connectionString = process.env.DATABASE_URL;
  let shouldUseSsl = explicitSslEnabled;

  try {
    const parsedUrl = new URL(process.env.DATABASE_URL);
    const sslMode = parsedUrl.searchParams.get('sslmode');
    const useLibpqCompat = parsedUrl.searchParams.get('uselibpqcompat');

    // If sslmode is present in URL, respect it by enabling SSL unless explicitly disabled
    if (sslMode && !explicitSslDisabled) {
      shouldUseSsl = true;
    }

    if (sslMode && ['prefer', 'require', 'verify-ca'].includes(sslMode) && !useLibpqCompat) {
      parsedUrl.searchParams.set('uselibpqcompat', 'true');
      connectionString = parsedUrl.toString();
      console.log(`DATABASE_URL detected with sslmode=${sslMode}; applying uselibpqcompat=true for pg compatibility`);
    }
  } catch (err) {
    console.warn('Could not parse DATABASE_URL for SSL normalization, using raw value');
  }

  // For cloud providers (Neon/Supabase/Render Postgres), SSL is typically required.
  // If DB_SSL is not explicitly set to false, default to SSL for DATABASE_URL.
  if (!explicitSslDisabled && !shouldUseSsl) {
    shouldUseSsl = true;
  }

  // Use connection string (Supabase or other cloud providers)
  poolConfig = {
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: shouldUseSsl ? { rejectUnauthorized: sslRejectUnauthorized } : false,
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