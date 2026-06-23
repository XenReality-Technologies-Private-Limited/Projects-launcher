import './style.css';
import { requireAuth } from './login.js';
import { initDatabase } from './db.js';
import { initDashboard } from './dashboard.js';
import { initReport } from './report.js';

function setView(view) {
  const app     = document.getElementById('app');
  const overlay = document.getElementById('report-modal-overlay');
  if (app)     app.style.display = view === 'report' ? 'none' : '';
  if (overlay) overlay.classList.toggle('open', view === 'report');
}

window.addEventListener('hashchange', () => {
  setView(window.location.hash === '#report' ? 'report' : 'dashboard');
});

async function bootstrap() {
  let dbData = null;

  try {
    dbData = await initDatabase();
  } catch (err) {
    // If the DB fails to load, we still render the UI and show graceful fallbacks.
    console.error('Failed to load KPI database:', err);
  }

  initDashboard(dbData);
  initReport(dbData);

  // Set initial view based on current hash
  setView(window.location.hash === '#report' ? 'report' : 'dashboard');

  // Set today's date on the report filter inputs
  const today = new Date().toISOString().slice(0, 10);
  const fromEl = document.getElementById('rpt-from-date');
  const toEl   = document.getElementById('rpt-to-date');
  if (fromEl) fromEl.value = today;
  if (toEl)   toEl.value   = today;
}

requireAuth(bootstrap);

