// Owns: HTTP endpoints for lead capture — form submission, notification.
const express = require('express');
const router = express.Router();
const { createLead } = require('../db/leads');

const LEAD_NOTIFY_EMAIL = process.env.LEAD_NOTIFY_EMAIL || 'nightowl-ai-35@polsia.app';

async function notifyTeamOfLead(lead) {
  try {
    await fetch('https://polsia.com/api/proxy/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.POLSIA_API_KEY}`,
      },
      body: JSON.stringify({
        to: LEAD_NOTIFY_EMAIL,
        subject: `New NightOwl lead: ${lead.name}`,
        body: [
          `New lead captured on NightOwl landing page`,
          ``,
          `Name: ${lead.name}`,
          `Email: ${lead.email}`,
          lead.business_name ? `Business: ${lead.business_name}` : '',
          lead.pain_point ? `Biggest admin headache: ${lead.pain_point}` : '',
          ``,
          `Submitted at: ${new Date(lead.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' })} EST`,
        ].filter(Boolean).join('\n'),
      }),
    });
  } catch (err) {
    console.error('[leads] notification email failed:', err.message);
  }
}

// POST /api/leads
router.post('/', async (req, res) => {
  const { name, email, business_name, pain_point } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  const emailRegex = /^[^\n@\t ]+@[^\n@\t ]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  try {
    const lead = await createLead({
      name: name.trim(),
      email: email.trim(),
      businessName: business_name ? business_name.trim() : null,
      painPoint: pain_point ? pain_point.trim() : null,
    });

    // Fire-and-forget email notification
    notifyTeamOfLead(lead);

    res.json({
      success: true,
      message: "We'll be in touch within 24 hours.",
    });
  } catch (err) {
    console.error('[leads] createLead error:', err.message);
    res.status(500).json({ error: 'Failed to submit. Please try again.' });
  }
});

module.exports = router;