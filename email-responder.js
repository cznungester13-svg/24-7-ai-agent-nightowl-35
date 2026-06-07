// Owns: AI-based draft response generation for routine emails.
// Does NOT own: classification (services/email-classifier.js), storage (db/emails.js).
const OpenAI = require('openai');

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
      const val = line.slice(colonIdx + 1).trim();
      if (key) headers[key] = val;
    }
  });
  return headers;
}

const SYSTEM_PROMPT = `You are NightOwl, writing a draft email response on behalf of a small business owner.

Rules:
- Professional but warm
- Directly address the sender's question or request
- Concise (3-5 sentences)
- End with appropriate closing
- If you don't know a specific detail, write [OWNER: add detail]

Respond ONLY with valid JSON (no markdown):
{"subject":"Re: <subject>","body":"email body text"}`;

/**
 * Generate a draft response for a routine email.
 * Returns { draftSubject, draftBody }
 */
async function generateDraftResponse({ subject, bodyText, senderEmail, senderName }) {
  const client = getClient();
  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

  const emailContent = [
    `From: ${senderName ? `${senderName} <${senderEmail}>` : senderEmail}`,
    `Subject: ${subject}`,
    '',
    (bodyText || '').slice(0, 2000)
  ].join('\n');

  const response = await client.chat.completions.create({
    model,
    max_tokens: 512,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `ORIGINAL EMAIL:\n${emailContent}` }
    ]
  });

  const raw = response.choices[0]?.message?.content || '{}';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Unexpected responder response: ${raw.slice(0, 200)}`);

  const result = JSON.parse(jsonMatch[0]);
  return {
    draftSubject: result.subject || `Re: ${subject}`,
    draftBody: result.body || ''
  };
}

module.exports = { generateDraftResponse };
