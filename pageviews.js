// Owns: page view data access — log, query.
const pool = require('./index');

async function logPageView({ path, referrer, userAgent, ipHash }) {
  const result = await pool.query(
    `INSERT INTO page_views (path, referrer, user_agent, ip_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at`,
    [path || '/', referrer || null, userAgent || null, ipHash || 'unknown']
  );
  return result.rows[0];
}

module.exports = { logPageView };