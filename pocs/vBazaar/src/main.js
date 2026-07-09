import './style.css';
import { requireAuth } from './login.js';
import { loadDB } from './poc-db.js';
import { renderDashboard } from './dashboard.js';

const CF = 'https://d2uimaqek2eby3.cloudfront.net/V%20Bazaar';
const DB_URL = `${CF}/Bazaar%20(1).db`;

const VIDEOS = {
  footfall: `${CF}/footfall_output_60mb.mp4`,
  billing:  `${CF}/compressed_billing_output.mp4`,
};

async function bootstrap() {
  const appEl = document.getElementById('app');
  appEl.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px;color:#6b7280;font-family:system-ui,sans-serif;">
      <div style="font-size:1.1rem;font-weight:600;">Loading V Bazaar Dashboard&hellip;</div>
      <div style="font-size:0.85rem;">Fetching database from CloudFront</div>
    </div>`;

  try {
    const data = await loadDB(DB_URL);
    renderDashboard(appEl, data, VIDEOS);
  } catch (err) {
    appEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:12px;color:#6b7280;font-family:system-ui,sans-serif;padding:24px;text-align:center;">
        <div style="font-size:1.1rem;font-weight:600;color:#b91c1c;">Failed to load dashboard</div>
        <div style="font-size:0.85rem;font-family:monospace;color:#ef4444;">${err?.message || 'Unknown error'}</div>
        <div style="font-size:0.8rem;margin-top:8px;">Check that the database URL is reachable and CloudFront has CORS configured.</div>
      </div>`;
  }
}

requireAuth(bootstrap);
