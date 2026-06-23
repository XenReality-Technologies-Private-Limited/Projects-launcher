import { requireAuth } from './login.js';
import { loadDB } from './db.js';
import { renderDashboard } from './dashboard.js';
import './style.css';

// ── CloudFront asset URLs ─────────────────────────────────────────────────────
const BASE = 'https://d2uimaqek2eby3.cloudfront.net/TechnoSport/';

const ASSET_URLS = {
  db:            BASE + 'TechnoSports.db',
  passerby:      BASE + 'passerby_output.mp4',
  footfallGround: BASE + 'footfall_ground_output.mp4',
  greetings:     BASE + 'greetings_output.mp4',
  footfallFirst: BASE + 'footfall_first_output.mp4',
  billing:       BASE + 'billing_output.mp4',
  heatmap:       BASE + 'heatmap_output.mp4',
  logo:          BASE + 'Technosport-logo.png',
};

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const app = document.getElementById('app');

app.innerHTML = `
  <div class="loading">
    <div class="loading-logo">
      <img src="https://d108xxen99ni2a.cloudfront.net/XenRealitylogo.webp"
           style="height:36px;filter:brightness(0) invert(1)" alt="XenReality" />
    </div>
    <div class="loading-spinner"></div>
    <div class="loading-text">Loading TechnoSport analytics&hellip;</div>
  </div>`;

async function init() {
  try {
    const data = await loadDB(ASSET_URLS.db);
    renderDashboard(app, data, ASSET_URLS);
  } catch (err) {
    app.innerHTML = `
      <div class="error-state">
        <h2>Could not load data</h2>
        <p>${err.message}</p>
        <p>Ensure <code>TechnoSports.db</code> is accessible at the CloudFront URL and CORS is enabled.</p>
      </div>`;
  }
}

requireAuth(init);
