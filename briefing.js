// Owns: morning briefing generation — aggregates overnight email activity into HTML + text summary.
// Does NOT own: email storage (db/emails.js), sending logic (jobs/morning-briefing.js).
const OpenAI = require('openai');
const { getEmailsSince } = require('../db/emails');

function getClient() {
  return new OpenAI({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
    defaultHeaders: parseCustomHeaders(process.env.ANTHROPIC_CUSTOM_HEADERS)
  });
}

function parseCustomHeaders(raw) {
  if (!raw) return {};
  const headers = {};
  raw.split('\n').forEach(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx > -1) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      if (key) headers[key] = value;
    }
  });
  return headers;
}

/**
 * Generate a morning briefing for a given date.
 * Looks back 24 hours from `briefingDate` (default: today).
 * Returns { htmlContent, textSummary, counts }
 */
async function generateBriefing(briefingDate) {
  const date = briefingDate || new Date();
  const since = new Date(date);
  since.setHours(since.getHours() - 24);

  const emails = await getEmailsSince(since);

  const urgent = emails.filter(e => e.classification === 'urgent');
  const routine = emails.filter(e => e.classification === 'routine');
  const spam = emails.filter(e => e.classification === 'spam');
  const pending = emails.filter(e => e.classification === 'pending');

  const counts = {
    urgent: urgent.length,
    routine: routine.length,
    spam: spam.length,
    total: emails.length
  };

  // Build a compact email list for the AI prompt
  const emailSummaryLines = emails.slice(0, 20).map(e =>
    `[${e.classification?.toUpperCase() || 'PENDING'}] From: ${e.sender_email} | Subject: ${e.subject}`
  ).join('\n');

  let aiSummary = '';

  if (emails.length > 0) {
    const client = getClient();
    const response = await client.chat.completions.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content: 'You are NightOwl, writing a concise morning briefing for a small business owner. Be specific about counts. Highlight urgent items.'
        },
        {
          role: 'user',
          content: `Write a brief, friendly morning briefing paragraph (3-5 sentences) summarizing overnight email activity.

Email activity (last 24h):
- Total: ${counts.total}
- Urgent: ${counts.urgent}
- Routine: ${counts.routine}
- Spam: ${counts.spam}

Email list:
${emailSummaryLines || '(no emails)'}

Write the paragraph now:`
        }
      ]
    });
    aiSummary = response.choices[0]?.message?.content || '';
  } else {
    aiSummary = 'Quiet night — no new emails arrived in the last 24 hours. Your inbox is clear and ready for the day.';
  }

  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const htmlContent = buildBriefingHTML({ dateStr, aiSummary, urgent, routine, counts });
  const textSummary = aiSummary;

  return { htmlContent, textSummary, counts };
}

function buildBriefingHTML({ dateStr, aiSummary, urgent, counts }) {
  const urgentItems = urgent.length > 0
    ? urgent.map(e => `
        <li style="margin-bottom:8px; padding:10px; background:#1a0a0a; border-left:3px solid #ef4444; border-radius:4px;">
          <strong style="color:#fca5a5;">${escapeHtml(e.subject)}</strong><br>
          <span style="color:#888; font-size:0.85em;">From: ${escapeHtml(e.sender_email)}</span>
        </li>`).join('')
    : '<li style="color:#888;">No urgent emails — all clear.</li>';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NightOwl Morning Briefing — ${dateStr}</title>
</head>
<body style="margin:0; padding:0; background:#0a0a0f; color:#e8e8ed; font-family:Inter, -apple-system, sans-serif;">
  <div style="max-width:600px; margin:0 auto; padding:40px 20px;">

    <!-- Header -->
    <div style="text-align:center; margin-bottom:32px;">
      <div style="display:inline-block; background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.25); border-radius:100px; padding:6px 18px; font-size:12px; font-weight:600; letter-spacing:0.1em; color:#f59e0b; margin-bottom:16px;">NIGHTOWL BRIEFING</div>
      <h1 style="margin:0; font-size:24px; font-weight:700; color:#e8e8ed;">${dateStr}</h1>
      <p style="margin:8px 0 0; color:#888; font-size:14px;">Your overnight summary</p>
    </div>

    <!-- AI Summary -->
    <div style="background:#16161f; border:1px solid #1e1e2a; border-radius:12px; padding:24px; margin-bottom:24px;">
      <p style="margin:0; line-height:1.7; color:#c0c0d0;">${escapeHtml(aiSummary)}</p>
    </div>

    <!-- Stats row -->
    <div style="display:flex; gap:12px; margin-bottom:24px;">
      <div style="flex:1; background:#16161f; border:1px solid #1e1e2a; border-radius:10px; padding:16px; text-align:center;">
        <div style="font-size:28px; font-weight:700; color:#fbbf24;">${counts.total}</div>
        <div style="font-size:12px; color:#888; margin-top:4px; text-transform:uppercase; letter-spacing:0.08em;">Total</div>
      </div>
      <div style="flex:1; background:#16161f; border:1px solid #1e1e2a; border-radius:10px; padding:16px; text-align:center;">
        <div style="font-size:28px; font-weight:700; color:#ef4444;">${counts.urgent}</div>
        <div style="font-size:12px; color:#888; margin-top:4px; text-transform:uppercase; letter-spacing:0.08em;">Urgent</div>
      </div>
      <div style="flex:1; background:#16161f; border:1px solid #1e1e2a; border-radius:10px; padding:16px; text-align:center;">
        <div style="font-size:28px; font-weight:700; color:#22c55e;">${counts.routine}</div>
        <div style="font-size:12px; color:#888; margin-top:4px; text-transform:uppercase; letter-spacing:0.08em;">Routine</div>
      </div>
      <div style="flex:1; background:#16161f; border:1px solid #1e1e2a; border-radius:10px; padding:16px; text-align:center;">
        <div style="font-size:28px; font-weight:700; color:#555570;">${counts.spam}</div>
        <div style="font-size:12px; color:#888; margin-top:4px; text-transform:uppercase; letter-spacing:0.08em;">Spam</div>
      </div>
    </div>

    <!-- Urgent items -->
    ${counts.urgent > 0 ? `
    <div style="background:#16161f; border:1px solid #1e1e2a; border-radius:12px; padding:24px; margin-bottom:24px;">
      <h2 style="margin:0 0 16px; font-size:16px; font-weight:600; color:#fca5a5;">🔴 Urgent — Needs Your Attention</h2>
      <ul style="list-style:none; margin:0; padding:0;">
        ${urgentItems}
      </ul>
    </div>` : ''}

    <!-- Footer -->
    <div style="text-align:center; padding-top:24px; border-top:1px solid #1e1e2a;">
      <p style="margin:0; color:#555570; font-size:13px;">
        NightOwl · <a href="https://nightowl-ai-35.polsia.app/dashboard" style="color:#f59e0b; text-decoration:none;">Open Dashboard</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { generateBriefing };
