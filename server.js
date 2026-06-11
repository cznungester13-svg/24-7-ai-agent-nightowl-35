const express = require('express');
const path = require('path');
const { buildLandingContext } = require('./lib/landing-context');

const app = express();
const port = process.env.PORT || 3000;

// Fail fast if DATABASE_URL is missing
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

app.use(express.json());

// EJS view engine. Templates live in ./views/ (entry point: layout.ejs).
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname,'.'));

// Health check endpoint (required for Render)
// Note: Does NOT query database to allow Neon auto-suspend
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Serve static files from public folder.
// `index: false` disables auto-serving public/index.html as the directory
// index — `/` always hits the EJS render route below, which is the only
// thing that should ever serve the landing page on this template.
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// API routes
app.use('/api/triage', require('./routes/triage'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api', require('./routes/analytics'));

// Landing page
app.get('/', (_req, res) => {
  res.render('layout', buildLandingContext());
});

// Dashboard (email triage inbox)
app.get('/dashboard', (_req, res) => {
  res.render('dashboard', buildLandingContext());
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
