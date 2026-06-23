import { requireAuth } from './login.js';
import { loadForSQL1 }      from './db.js';
import { loadZoneEvents }   from './events.js';
import { computeAnalytics } from './analytics.js';
import { renderDashboard }  from './dashboard.js';
import './style.css';

// ── CloudFront asset URLs ─────────────────────────────────────────────────
// Update CLOUDFRONT_BASE_URL once you receive the CloudFront distribution URL.
const CLOUDFRONT_BASE_URL = 'https://d2uimaqek2eby3.cloudfront.net/US-Polo/';

export const ASSET_URLS = {
  db:         CLOUDFRONT_BASE_URL + 'for_sql.db',
  zoneEvents: CLOUDFRONT_BASE_URL + 'zone_events.csv',
  cam1:       CLOUDFRONT_BASE_URL + 'cam1_tracked(1).mp4',
  cam2:       CLOUDFRONT_BASE_URL + 'cam2_tracked(1).mp4',
  cam5:       CLOUDFRONT_BASE_URL + 'cam5_tracked(1).mp4',
};

// ── Bootstrap ─────────────────────────────────────────────────────────────
const app = document.getElementById('app');

app.innerHTML = `
  <div class="loading">
    <div class="header-logo-fallback" style="display:flex;font-size:22px;letter-spacing:.08em;color:#fff;font-weight:800">US POLO</div>
    <div class="loading-spinner"></div>
    <div class="loading-text">Loading store analytics...</div>
  </div>`;

async function init() {
  try {
    const [rows, zoneEvents] = await Promise.all([
      loadForSQL1(ASSET_URLS.db),
      loadZoneEvents(ASSET_URLS.zoneEvents),
    ]);

    if (rows.length === 0) {
      throw new Error('Database loaded but for_sql_1 table is empty.');
    }

    const analytics = computeAnalytics(rows, zoneEvents);
    renderDashboard(app, analytics, rows, ASSET_URLS);
  } catch (err) {
    app.innerHTML = `
      <div class="error-state">
        <h2>Could not load data</h2>
        <p>${err.message}</p>
        <p>Update <code>CLOUDFRONT_BASE_URL</code> in <code>src/main.js</code> with your CloudFront URL, then reload.</p>
      </div>`;
  }
}

requireAuth(init);
