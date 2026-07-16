import { requireAuth } from './login.js';
import { loadDB } from './db.js';
import { renderDashboard } from './dashboard.js';
import './style.css';

// ── CloudFront asset URLs ─────────────────────────────────────────────────────
const BASE = 'https://d2uimaqek2eby3.cloudfront.net/Kushals/';

const ASSET_URLS = {
  db:             BASE + 'Kushals.db',
  jcDb:           BASE + 'Kushals%20(1).db',
  passerby:       BASE + 'passerby_output%20(1).mp4',
  footfall:       BASE + 'footfall_output.mp4',
  greetings:      BASE + 'greetings_output%20(1).mp4',
  totalEmployees: BASE + 'total_employees_output.mp4',
  jewelleryClr:   BASE + 'jewellery_clearance_output%20(1).mp4',
  logo:           BASE + 'Kushals_New_Logo_.avif',
};

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const app = document.getElementById('app');

app.innerHTML = `
  <div class="loading">
    <div class="loading-logo">
      <img src="/xenlogo.png"
           style="height:36px;filter:brightness(0) invert(1)" alt="XenReality" />
    </div>
    <div class="loading-spinner"></div>
    <div class="loading-text">Loading Kushals analytics&hellip;</div>
  </div>`;

async function init() {
  try {
    const data = await loadDB(ASSET_URLS.db, ASSET_URLS.jcDb);
    renderDashboard(app, data, ASSET_URLS);
  } catch (err) {
    app.innerHTML = `
      <div class="error-state">
        <h2>Could not load data</h2>
        <p>${err.message}</p>
        <p>Ensure <code>Kushals.db</code> is accessible at the CloudFront URL and CORS is enabled.</p>
      </div>`;
  }
}

requireAuth(init);
