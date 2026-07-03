import './style.css';
import { requireAuth } from './login.js';
import { createDatabase, loadFootfall, loadPhoneUsage, loadTableCleanliness, loadWaterService } from './db.js';
import { renderDashboard } from './dashboard.js';

const CF = 'https://d2uimaqek2eby3.cloudfront.net/Paragon';
const DB_URL = `${CF}/Paragon%20(1).db`;

const CAMERAS = [
  { label: 'Footfall',          type: 'footfall',      videoUrl: `${CF}/footfall_output_compressed%20(1).mp4` },
  { label: 'Phone Usage',       type: 'phone-usage',   videoUrl: `${CF}/phone_output.mp4` },
  { label: 'Apron Check',       type: 'apron',         videoUrl: `${CF}/apron_output_compressed.mp4` },
  { label: 'Table Cleanliness', type: 'table-clean',   videoUrl: `${CF}/table_clean_output_compressed.mp4` },
  { label: 'Water Service',     type: 'water-service', videoUrl: `${CF}/water_pour_compressed.mp4` },
];

async function bootstrap() {
  const appEl = document.getElementById('app');
  appEl.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px;color:#6b7280;font-family:system-ui,sans-serif;">
      <div style="font-size:1.1rem;font-weight:600;">Loading Paragon Dashboard&hellip;</div>
      <div style="font-size:0.85rem;">Fetching database from CloudFront</div>
    </div>`;

  try {
    const db = await createDatabase(DB_URL);
    const allData = {
      footfall:     loadFootfall(db),
      phoneUsage:   loadPhoneUsage(db),
      tableClean:   loadTableCleanliness(db),
      waterService: loadWaterService(db),
    };
    db.close();
    await renderDashboard(appEl, CAMERAS, allData);
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
