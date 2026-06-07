// Owns: HTTP endpoints for email triage — submit emails, list/filter inbox, approve/reject drafts, trigger briefing.
// Does NOT own: AI logic (services/), database queries (db/emails.js).
const express = require('express');
const router = express.Router();
const db = require('../db/emails');
const { classifyEmail } = require('../services/email-classifier');
const { generateDraftResponse } = require('../services/email-responder');
const { generateBriefing } = require('../services/briefing');

// POST /api/triage/ingest
// Accepts incoming email payload, classifies it, and drafts a response for routine emails.
router.post('/ingest', async (req, res) => {
  try {
    const { messageId, senderEmail, senderName, subject, bodyText, bodyHtml, receivedAt } = req.body;
    if (!senderEmail || !subject) {
      return res.status(400).json({ error: 'senderEmail and subject are required' });
    }

    // Store the raw email first
    const email = await db.createEmail({ messageId, senderEmail, senderName, subject, bodyText, bodyHtml, receivedAt });
    if (!email) {
      return res.json({ status: 'duplicate', message: 'Email with this messageId already exists' });
    }

    // Classify asynchronously but still within the request (demo-friendly synchronous flow)
    const classification = await classifyEmail({ subject, bodyText, senderEmail, senderName });
    const updatedEmail = await db.updateEmailClassification(email.id, classification);

    let draft = null;
    // Auto-draft responses only for routine emails
    if (classification.classification === 'routine') {
      const { draftSubject, draftBody } = await generateDraftResponse({ subject, bodyText, senderEmail, senderName });
      draft = await db.createDraft({ emailId: email.id, draftBody, draftSubject });
    }

    res.json({ email: updatedEmail, classification, draft });
  } catch (err) {
    console.error('[triage/ingest]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/triage/ingest-demo
// Ingest a batch of demo emails for showcasing the product.
router.post('/ingest-demo', async (req, res) => {
  const demoEmails = [
    {
      messageId: `demo-urgent-${Date.now()}-1`,
      senderEmail: 'sarah.johnson@acme.com',
      senderName: 'Sarah Johnson',
      subject: 'URGENT: Invoice overdue - threatening legal action',
      bodyText: 'Hi, Our invoice #4821 for $3,400 is now 45 days overdue. If we do not receive payment by Friday we will be forced to pursue legal action. Please respond immediately.',
      receivedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    },
    {
      messageId: `demo-routine-${Date.now()}-2`,
      senderEmail: 'mike.r@gmail.com',
      senderName: 'Mike Rodriguez',
      subject: 'Question about your services',
      bodyText: 'Hi there, I came across your business online and I have some questions about your pricing and availability. Could you send me more information? Thanks, Mike',
      receivedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
    },
    {
      messageId: `demo-routine-${Date.now()}-3`,
      senderEmail: 'appt@booker.com',
      senderName: 'Lisa Chen',
      subject: 'Appointment request for next week',
      bodyText: 'Hello, I would like to schedule an appointment for next Tuesday or Wednesday afternoon if possible. Please let me know your availability.',
      receivedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
    },
    {
      messageId: `demo-spam-${Date.now()}-4`,
      senderEmail: 'noreply@promo-deals.net',
      senderName: 'PromoDeals',
      subject: 'You have been selected for a FREE BUSINESS LOAN! Act now',
      bodyText: 'Congratulations! You have been pre-approved for a $50,000 business loan. Click here to claim your money today. Limited time offer!!!',
      receivedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()
    },
    {
      messageId: `demo-urgent-${Date.now()}-5`,
      senderEmail: 'david.kim@partnercorp.io',
      senderName: 'David Kim',
      subject: 'Partnership proposal - time sensitive (respond by EOD)',
      bodyText: 'Hi, We have a partnership opportunity that could generate significant revenue for both companies. I need a response by end of day today to proceed. This is a limited window opportunity.',
      receivedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString()
    }
  ];

  const results = [];
  for (const e of demoEmails) {
    try {
      const email = await db.createEmail(e);
      if (!email) { results.push({ skipped: true, messageId: e.messageId }); continue; }
      const classification = await classifyEmail({ subject: e.subject, bodyText: e.bodyText, senderEmail: e.senderEmail, senderName: e.senderName });
      const updatedEmail = await db.updateEmailClassification(email.id, classification);
      let draft = null;
      if (classification.classification === 'routine') {
        const { draftSubject, draftBody } = await generateDraftResponse({ subject: e.subject, bodyText: e.bodyText, senderEmail: e.senderEmail, senderName: e.senderName });
        draft = await db.createDraft({ emailId: email.id, draftBody, draftSubject });
      }
      results.push({ email: updatedEmail, classification, draft });
    } catch (err) {
      results.push({ error: err.message, messageId: e.messageId });
    }
  }
  res.json({ processed: results.length, results });
});

// GET /api/triage/emails
// List emails with optional filters: ?classification=urgent&status=new
router.get('/emails', async (req, res) => {
  try {
    const { classification, status, limit, offset } = req.query;
    const emails = await db.listEmails({
      classification,
      status,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });
    res.json({ emails });
  } catch (err) {
    console.error('[triage/emails]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/triage/emails/:id
router.get('/emails/:id', async (req, res) => {
  try {
    const email = await db.getEmailById(req.params.id);
    if (!email) return res.status(404).json({ error: 'Not found' });
    await db.markEmailRead(email.id);
    const draft = await db.getDraftByEmailId(email.id);
    res.json({ email, draft });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/triage/emails/:id/status
router.patch('/emails/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });
    const email = await db.updateEmailStatus(req.params.id, status);
    res.json({ email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/triage/drafts/:id
// Update or approve/reject a draft
router.patch('/drafts/:id', async (req, res) => {
  try {
    const { draftBody, draftSubject, approvalStatus } = req.body;
    const draft = await db.updateDraft(req.params.id, { draftBody, draftSubject, approvalStatus });
    res.json({ draft });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/triage/stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await db.getEmailStats();
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/triage/briefing/generate
// Manually trigger briefing generation (also called by the cron job)
router.post('/briefing/generate', async (req, res) => {
  try {
    const { htmlContent, textSummary, counts } = await generateBriefing(new Date());
    const today = new Date().toISOString().slice(0, 10);
    const briefing = await require('../db/emails').createBriefing({
      briefingDate: today,
      htmlContent,
      textSummary,
      emailCountUrgent: counts.urgent,
      emailCountRoutine: counts.routine,
      emailCountSpam: counts.spam
    });
    res.json({ briefing });
  } catch (err) {
    console.error('[triage/briefing/generate]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/triage/briefing/latest
router.get('/briefing/latest', async (req, res) => {
  try {
    const briefing = await db.getLatestBriefing();
    res.json({ briefing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
