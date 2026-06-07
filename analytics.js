// Owns: HTTP endpoints for analytics — pageview tracking, event tracking.
// Does NOT own: DB access (lives in db/pageviews.js, db/events.js).
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { logPageView } = require('../db/pageviews');
const { logEvent } = require('../db/events');

function hashIp(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
    return 'localhost';
  }
  return crypto.createHash('sha256').update(ip + (process.env.IP_HASH_SALT || '')).digest('hex').slice(0, 32);
}

// POST /api/pageview
// Body: { path, referrer }
// Optionally pass path via query param for GET use.
router.post('/pageview', async (req, res) => {
  try {
    const ipHash = hashIp(req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress);
    await logPageView({
      path: req.body.path || '/',
      referrer: req.body.referrer || req.headers.referer || null,
      userAgent: req.headers['user-agent'] || null,
      ipHash,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[analytics] pageview error:', err.message);
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/pageview?path=... — for use with image beacons (1x1 pixel trick)
router.get('/pageview', async (req, res) => {
  try {
    const ipHash = hashIp(req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress);
    await logPageView({
      path: req.query.path || '/',
      referrer: req.headers.referer || null,
      userAgent: req.headers['user-agent'] || null,
      ipHash,
    });
    res.set('Cache-Control', 'no-store');
    res.set('Content-Type', 'image/gif');
    res.send(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
  } catch (err) {
    console.error('[analytics] pageview GET error:', err.message);
    res.status(204).end();
  }
});

// POST /api/event
// Body: { event_type, event_data, referrer }
router.post('/event', async (req, res) => {
  try {
    const ipHash = hashIp(req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress);
    const { event_type, event_data, referrer } = req.body;
    if (!event_type || typeof event_type !== 'string' || event_type.length > 64) {
      return res.status(400).json({ error: 'Invalid event_type' });
    }
    await logEvent({
      eventType: event_type,
      eventData: event_data || {},
      referrer: referrer || req.headers.referer || null,
      ipHash,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[analytics] event error:', err.message);
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;