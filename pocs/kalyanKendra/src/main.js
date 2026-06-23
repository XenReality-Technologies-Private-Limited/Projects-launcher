import './style.css';
import { requireAuth } from './login.js';
import { loadAllData } from './db.js';
import { renderDashboard } from './dashboard.js';

const CF = 'https://d2uimaqek2eby3.cloudfront.net/Kalyan-Kendra';
const DB_URL = `${CF}/KalyanKendra.db`;

const CAMERAS = [
  { label: 'Footfall',    type: 'footfall',   videoUrl: `${CF}/footfall_output_compressed.mp4` },
  { label: 'Greetings',  type: 'greetings',  videoUrl: `${CF}/greetings_output_first_3min_compressed.mp4` },
  { label: 'Pantry',     type: 'pantry',     videoUrl: `${CF}/pantry_output_compressed.mp4` },
  { label: 'Trial Room', type: 'trials',     videoUrl: `${CF}/trialroom_output_first_3m14s_compressed.mp4` },
];

async function bootstrap() {
  const appEl = document.getElementById('app');

  appEl.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px;color:#6b7280;font-family:system-ui,sans-serif;">
      <div style="font-size:1.1rem;font-weight:600;">Loading Kalyan Kendra Dashboard&hellip;</div>
      <div style="font-size:0.85rem;">Fetching database from CloudFront</div>
    </div>`;

  try {
    const allData = await loadAllData(DB_URL);
    await renderDashboard(appEl, CAMERAS, allData);
  } catch (err) {
    appEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:12px;color:#6b7280;font-family:system-ui,sans-serif;padding:24px;text-align:center;">
        <div style="font-size:1.1rem;font-weight:600;color:#b91c1c;">Failed to load dashboard</div>
        <div style="font-size:0.85rem;font-family:monospace;color:#ef4444;">${err?.message || 'Unknown error'}</div>
        <div style="font-size:0.8rem;margin-top:8px;">Check that the database URL is reachable and that CloudFront has CORS configured for this origin.</div>
      </div>`;
  }
}

requireAuth(bootstrap);
