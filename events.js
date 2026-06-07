// Owns: event data access — log, query.
const pool = require('./index');

async function logEvent({ eventType, eventData, referrer, ipHash }) {
  const result = await pool.query(
    `INSERT INTO events (event_type, event_data, referrer, ip_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at`,
    [eventType, eventData || null, referrer || null, ipHash || null]
  );
  return result.rows[0];
}

module.exports = { logEvent };