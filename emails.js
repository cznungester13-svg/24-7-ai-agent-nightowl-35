// Owns: all SQL for emails, email_drafts, and briefings tables.
// Does NOT own: AI logic (services/), HTTP handling (routes/), pool creation (db/index.js).
const pool = require('./index');

// ─── Emails ───

async function createEmail({ messageId, senderEmail, senderName, subject, bodyText, bodyHtml, receivedAt }) {
  const res = await pool.query(
    `INSERT INTO emails
       (message_id, sender_email, sender_name, subject, body_text, body_html, received_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (message_id) DO NOTHING
     RETURNING *`,
    [messageId, senderEmail, senderName, subject, bodyText, bodyHtml, receivedAt || new Date()]
  );
  return res.rows[0] || null;
}

async function getEmailById(id) {
  const res = await pool.query('SELECT * FROM emails WHERE id = $1', [id]);
  return res.rows[0] || null;
}

async function listEmails({ classification, status, limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  if (classification) { params.push(classification); conditions.push(`classification = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);
  const res = await pool.query(
    `SELECT e.*, d.draft_body, d.draft_subject, d.approval_status AS draft_approval_status, d.id AS draft_id
     FROM emails e
     LEFT JOIN email_drafts d ON d.email_id = e.id
     ${where}
     ORDER BY e.received_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return res.rows;
}

async function updateEmailClassification(id, { classification, confidence, reasoning }) {
  const res = await pool.query(
    `UPDATE emails
     SET classification = $2, classification_confidence = $3, classification_reasoning = $4,
         status = CASE WHEN $2 = 'urgent' THEN 'needs_review' WHEN $2 = 'spam' THEN 'archived' ELSE 'triaged' END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, classification, confidence, reasoning]
  );
  return res.rows[0];
}

async function updateEmailStatus(id, status) {
  const res = await pool.query(
    'UPDATE emails SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
    [id, status]
  );
  return res.rows[0];
}

async function markEmailRead(id) {
  await pool.query('UPDATE emails SET is_read = TRUE, updated_at = NOW() WHERE id = $1', [id]);
}

// Returns emails received since a given timestamp (for overnight briefing window)
async function getEmailsSince(since) {
  const res = await pool.query(
    'SELECT * FROM emails WHERE received_at >= $1 ORDER BY received_at DESC',
    [since]
  );
  return res.rows;
}

async function getEmailStats() {
  const res = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE classification = 'urgent') AS urgent,
      COUNT(*) FILTER (WHERE classification = 'routine') AS routine,
      COUNT(*) FILTER (WHERE classification = 'spam') AS spam,
      COUNT(*) FILTER (WHERE classification = 'pending') AS pending,
      COUNT(*) FILTER (WHERE status = 'needs_review') AS needs_review,
      COUNT(*) AS total
    FROM emails
  `);
  return res.rows[0];
}

// ─── Drafts ───

async function createDraft({ emailId, draftBody, draftSubject }) {
  const res = await pool.query(
    `INSERT INTO email_drafts (email_id, draft_body, draft_subject)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [emailId, draftBody, draftSubject]
  );
  return res.rows[0];
}

async function getDraftByEmailId(emailId) {
  const res = await pool.query(
    'SELECT * FROM email_drafts WHERE email_id = $1 ORDER BY created_at DESC LIMIT 1',
    [emailId]
  );
  return res.rows[0] || null;
}

async function updateDraft(id, { draftBody, draftSubject, approvalStatus }) {
  const res = await pool.query(
    `UPDATE email_drafts
     SET draft_body = COALESCE($2, draft_body),
         draft_subject = COALESCE($3, draft_subject),
         approval_status = COALESCE($4, approval_status),
         approved_at = CASE WHEN $4 = 'approved' THEN NOW() ELSE approved_at END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, draftBody, draftSubject, approvalStatus]
  );
  return res.rows[0];
}

async function listPendingDrafts() {
  const res = await pool.query(`
    SELECT d.*, e.subject, e.sender_email, e.sender_name, e.body_text
    FROM email_drafts d
    JOIN emails e ON e.id = d.email_id
    WHERE d.approval_status = 'pending'
    ORDER BY d.created_at DESC
  `);
  return res.rows;
}

// ─── Briefings ───

async function createBriefing({ briefingDate, htmlContent, textSummary, emailCountUrgent, emailCountRoutine, emailCountSpam }) {
  const res = await pool.query(
    `INSERT INTO briefings
       (briefing_date, html_content, text_summary, email_count_urgent, email_count_routine, email_count_spam)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (briefing_date) DO UPDATE
       SET html_content = EXCLUDED.html_content,
           text_summary = EXCLUDED.text_summary,
           email_count_urgent = EXCLUDED.email_count_urgent,
           email_count_routine = EXCLUDED.email_count_routine,
           email_count_spam = EXCLUDED.email_count_spam
     RETURNING *`,
    [briefingDate, htmlContent, textSummary, emailCountUrgent, emailCountRoutine, emailCountSpam]
  );
  return res.rows[0];
}

async function getLatestBriefing() {
  const res = await pool.query(
    'SELECT * FROM briefings ORDER BY briefing_date DESC LIMIT 1'
  );
  return res.rows[0] || null;
}

async function markBriefingSent(id) {
  await pool.query(
    'UPDATE briefings SET send_status = $2, sent_at = NOW() WHERE id = $1',
    [id, 'sent']
  );
}

module.exports = {
  createEmail,
  getEmailById,
  listEmails,
  updateEmailClassification,
  updateEmailStatus,
  markEmailRead,
  getEmailsSince,
  getEmailStats,
  createDraft,
  getDraftByEmailId,
  updateDraft,
  listPendingDrafts,
  createBriefing,
  getLatestBriefing,
  markBriefingSent
};
