import './style.css';
import { requireAuth } from './login.js';
import { loadDB } from './db.js';
import { renderDashboard } from './dashboard.js';

const CF = 'https://d2uimaqek2eby3.cloudfront.net/Yamaha';
const DB_URL = `${CF}/Yamaha.db`;

const VIDEOS = {
  passerby:    `${CF}/passerby_output%20(2).mp4`,
  footfall:    `${CF}/footfall_output%20(1).mp4`,
  greetings:   `${CF}/greetings_output%20(3).mp4`,
  empInteract: `${CF}/employee_interactions_output%20(1).mp4`,
  heatmap:     `${CF}/heatmap_output%20(1).mp4`,
};

async function bootstrap() {
  const appEl = document.getElementById('app');
  appEl.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px;color:#6b7280;font-family:system-ui,sans-serif;">
      <div style="font-size:1.1rem;font-weight:600;">Loading Thomsun - Yamaha Dashboard&hellip;</div>
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
