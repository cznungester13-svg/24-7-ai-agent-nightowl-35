// Owns: database connection pool singleton.
// Does NOT own: query logic (lives in db/<entity>.js files), migrations (migrate.js).
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

module.exports = pool;
