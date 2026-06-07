/**
 * Morning Briefing Job
 *
 * Invoked by the polsia.toml [[crons]] entry (schedule: 0 7 * * *).
 * Generates the daily briefing, stores it in the database, and logs completion.
 *
 * NOT a long-running process — runs, completes, exits.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { generateBriefing } = require('../services/briefing');
const db = require('../db/emails');

async function run() {
  console.log('[morning-briefing] Starting briefing generation...');
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const { htmlContent, textSummary, counts } = await generateBriefing(now);

  const briefing = await db.createBriefing({
    briefingDate: today,
    htmlContent,
    textSummary,
    emailCountUrgent: counts.urgent,
    emailCountRoutine: counts.routine,
    emailCountSpam: counts.spam
  });

  console.log(`[morning-briefing] Done. Date=${today} Total=${counts.total} Urgent=${counts.urgent} Routine=${counts.routine} Spam=${counts.spam} BriefingId=${briefing.id}`);
}

run().catch(err => {
  console.error('[morning-briefing] ERROR:', err.message);
  process.exit(1);
});
