# CLAUDE.md

## What this app does
NightOwl is an AI operations agent for small business owners. It triages incoming emails (classify as urgent/routine/spam), auto-drafts responses to routine inquiries, queues urgent items for owner review, delivers a daily morning briefing, and captures landing page leads for follow-up.

## Stack
Node.js + Express + PostgreSQL (Neon) + OpenAI-compatible API (Anthropic via Polsia proxy)

## Directory map
- `server.js` — app entry point, middleware wiring, route mounts, app.listen
- `routes/` — Express Router modules, one file per feature group
- `db/` — all database access; only db/index.js creates Pool, all queries in named functions
- `services/` — business logic (AI classification, response drafting, briefing generation)
- `jobs/` — cron-triggered scripts (morning briefing)
- `migrations/` — DDL only, one file per schema change, named `{timestamp}_{name}.js`
- `views/` — EJS templates (layout.ejs + partials/ including pricing, hero, features, etc.)
- `public/` — static assets (CSS, JS)
- `lib/` — shared utilities (landing-context.js)

## Database
- `users` — end-user accounts with subscription fields (synced by Polsia)
- `emails` — incoming email records with subject, body, sender, classification, status
- `email_drafts` — AI-drafted responses linked to emails, with approval status
- `briefings` — generated morning briefing records with html content and send status
- `leads` — landing page contact form submissions (name, email, business_name, pain_point, created_at)
- `page_views` — raw visit records: path, referrer, user_agent, ip_hash (hashed), created_at
- `events` — typed analytics events with JSONB payload: cta_click, form_view, etc.

## External integrations
- OpenAI-compatible API via ANTHROPIC_BASE_URL proxy — email classification and response drafting
- Neon PostgreSQL via DATABASE_URL — all persistent data
- Polsia email proxy (polsia.com/api/proxy/email) — lead notification emails to nightowl-ai-35@polsia.app

## Recent changes
- 2026-05-28: Added analytics tracking — POST/GET /api/pageview and POST /api/event endpoints. Client beacon fires on every page load and exposes window.trackEvent(type, data) for CTA click tracking. IP addresses hashed with SHA-256 before storage.
- 2026-05-24: Added lead capture contact form — modal triggered by "Talk to us" CTAs in hero and pricing, plus inline form section below closing. Stores leads in `leads` table and emails nightowl-ai-35@polsia.app on submission.
- 2026-05-22: Added $20/mo pricing section to landing page with charity angle (25% to verified charity, first 6 months)
- 2026-05-21: Initial build — email triage engine with AI classification, draft responses, morning briefing job, triage dashboard UI