// Owns: AI-based email classification (urgent / routine / spam).
// Does NOT own: database writes (db/emails.js), HTTP transport (routes/triage.js).
const OpenAI = require('openai');

// Polsia proxy is OpenAI-compatible; use openai package pointed at ANTHROPIC_BASE_URL.
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

const SYSTEM_PROMPT = `You are NightOwl, an AI email triage assistant for small business owners.

Classify the email into exactly one category:
- "urgent": Needs owner attention today — angry customer, payment problem, legal matter, time-sensitive opportunity
- "routine": Standard business communication — inquiries, quotes, scheduling, general questions that get templated responses
- "spam": Unsolicited marketing, newsletters, automated notifications with no action needed

Respond ONLY with valid JSON (no markdown):
{"classification":"urgent","confidence":0.95,"reasoning":"one sentence"}`;

/**
 * Classify a single email using AI.
 * Returns { classification, confidence, reasoning }
 */
async function classifyEmail({ subject, bodyText, senderEmail, senderName }) {
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
    max_tokens: 256,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: emailContent }
    ]
  });

  const raw = response.choices[0]?.message?.content || '{}';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Unexpected classifier response: ${raw.slice(0, 200)}`);

  const result = JSON.parse(jsonMatch[0]);
  return {
    classification: result.classification || 'routine',
    confidence: parseFloat(result.confidence) || 0.8,
    reasoning: result.reasoning || ''
  };
}

module.exports = { classifyEmail };
