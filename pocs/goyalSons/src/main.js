import './style.css';
import { requireAuth } from './login.js';
import { loadData } from './db.js';
import { renderDashboard } from './dashboard.js';

const CF        = 'https://d2uimaqek2eby3.cloudfront.net/Goyal-Sons';
const DB_URL    = `${CF}/recognition.db`;
const VIDEO_URL = `${CF}/annotated_faces.mp4`;
const LOGO_URL  = `${CF}/Goyal_Sons_Logo.png`;

async function bootstrap() {
  const appEl = document.getElementById('app');

  appEl.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;
                flex-direction:column;gap:16px;color:#6b7280;font-family:system-ui,sans-serif;">
      <div style="font-size:1.1rem;font-weight:600;">Loading Goyal &amp; Sons Dashboard&hellip;</div>
      <div style="font-size:0.85rem;">Fetching database from CloudFront</div>
    </div>`;

  try {
    const data = await loadData(DB_URL);
    renderDashboard(appEl, { videoUrl: VIDEO_URL, logoUrl: LOGO_URL }, data);
  } catch (err) {
    appEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;
                  flex-direction:column;gap:12px;color:#6b7280;font-family:system-ui,sans-serif;
                  padding:24px;text-align:center;">
        <div style="font-size:1.1rem;font-weight:600;color:#b91c1c;">Failed to load dashboard</div>
        <div style="font-size:0.85rem;font-family:monospace;color:#ef4444;">${err?.message || 'Unknown error'}</div>
      </div>`;
  }
}

requireAuth(bootstrap);
