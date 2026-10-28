import './style.css';
import { requireAuth } from './login.js';
import { renderDashboard } from './dashboard.js';

const CF = 'https://d2uimaqek2eby3.cloudfront.net/Hilite-Mall';

// One entry per detected incident clip. Each clip is its own short recording
// (not a continuous feed), already pre-identified by the pipeline as
// containing suspicious activity — the events.json just needs reading, not
// the tracks.json (per-frame tracking data the frontend doesn't need).
const CLIPS = [
  { id: 'b2',      label: 'Camera B2',       video: `${CF}/detected_01_B2_0m02s.mp4`,                 events: `${CF}/detected_01_B2_0m02s.events.json` },
  { id: 'd19',     label: 'Camera D19',      video: `${CF}/detected_02_D19_3m55s.mp4`,                events: `${CF}/detected_02_D19_3m55s.events.json` },
  { id: 'admin3',  label: 'Admin — CH3',     video: `${CF}/detected_03_admin_ch3_0m54s.mp4`,          events: `${CF}/detected_03_admin_ch3_0m54s.events.json` },
  { id: 'bs2md',   label: 'BS2 MD Parking',  video: `${CF}/detected_04_BS2-MD-PARKING_1m09s.mp4`,     events: `${CF}/detected_04_BS2-MD-PARKING_1m09s.events.json` },
];

async function bootstrap() {
  const appEl = document.getElementById('app');

  appEl.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;
                flex-direction:column;gap:16px;color:#6b7280;font-family:system-ui,sans-serif;">
      <div style="font-size:1.1rem;font-weight:600;">Loading Hilite Mall Dashboard&hellip;</div>
      <div style="font-size:0.85rem;">Fetching incident data from CloudFront</div>
    </div>`;

  try {
    const clipsWithEvents = await Promise.all(
      CLIPS.map(async (clip) => {
        const res = await fetch(`${clip.events}?v=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${clip.events}`);
        const data = await res.json();
        return { ...clip, data };
      })
    );
    renderDashboard(appEl, clipsWithEvents);
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
