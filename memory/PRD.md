# NightOwl — Launch Fix + De-Polsia PRD

## Original problem statement
Fix launch-blocking bugs in the NightOwl app (Express + EJS + Postgres). Root cause: repo files were flattened to root; `require()` paths expected a nested folder structure, so the serverless function crashed on boot (`Cannot find module './routes/triage'`). Follow-up request from user: **remove Polsia completely.**

## Source of truth
GitHub: https://github.com/cznungester13-svg/24-7-ai-agent-nightowl-35
The repo contained `nightowl-ai-agent-1.zip` with the intact original tree — used as the source of truth. Corrected repo delivered at `/app/nightowl-fixed/` (git-committed) and `/app/nightowl-fixed.zip`.

## Architecture (after fix)
- Node.js 20 + Express, EJS views (`views/` + `views/partials/`), static `public/css/theme.css`
- PostgreSQL (Neon/Render) via `DATABASE_URL`, migrations in `migrations/` run on deploy (`npm run build` → `migrate.js`)
- AI: **direct Anthropic Claude** (`@anthropic-ai/sdk`, `ANTHROPIC_API_KEY`, model `ANTHROPIC_MODEL` default `claude-haiku-4-5`)
- Email: **Resend** (`resend`, `RESEND_API_KEY`, `RESEND_FROM`, `LEAD_NOTIFY_EMAIL`)
- Analytics: first-party only (`/api/pageview`, `/api/event` → `page_views`, `events` tables)
- Cron: morning briefing as a Render Cron Job (`render.yaml`)
- Deploy: Render (primary, `render.yaml`); Vercel supported (`vercel.json` includeFiles + `module.exports = app`)

## Work done (2026-08-04)
- Restored folder structure (routes/, db/, services/, lib/, views/, public/css/, migrations/) from the zip
- server.js: `./lib/landing-context`, explicit views dir, no migrate-on-import, DATABASE_URL warns (not exit) so landing/health render without DB, exported app for serverless
- layout.ejs: correct includes (single `partials/footer`, `partials/contact-form`)
- Added `migrations/20260101_core_schema.js` creating emails, email_drafts, briefings, leads, page_views, events (the zip had no table migrations — real gap); dropped corrupted `20260610_extra_engines.js`
- render.yaml: `buildCommand: npm install && npm run build`, declared env vars, added cron service
- **Removed Polsia entirely:** AI proxy → direct Anthropic SDK; lead email proxy → Resend; analytics pixel → first-party only; `polsia.toml` deleted; all `*.polsia.app`/`polsia.com` references replaced

## Verified locally (Postgres 15)
`/health` healthy · `/` 200 styled · `/dashboard` 200 · `POST /api/leads` inserts row (Resend skips gracefully when unset) · analytics endpoints ok · `POST /api/triage/ingest-demo` degrades gracefully without keys (Anthropic auth error per email, server stays up) · boots with no DATABASE_URL.
NOT live-verified: real Claude classification + real Resend send (requires user's ANTHROPIC_API_KEY / RESEND_API_KEY).

## Open / next
- Ship code to user's GitHub (needs a write token) — currently delivered as folder + zip
- Provision Postgres and set env vars on Render, deploy
- Provide ANTHROPIC_API_KEY + RESEND_API_KEY/RESEND_FROM/LEAD_NOTIFY_EMAIL for live AI + email
