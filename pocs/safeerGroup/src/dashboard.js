import { loadAllData } from './db.js';

const CF = 'https://d2uimaqek2eby3.cloudfront.net/Safeer';

const CAMERAS = [
  { id: 1, label: 'Camera 1', video: `${CF}/merged_1.mp4` },
  { id: 2, label: 'Camera 2', video: `${CF}/merged_2.mp4` },
];

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = String(Math.floor(secs % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

// ── render ────────────────────────────────────────────────────────────────────

export async function initDashboard(appEl) {
  // Loading shell
  appEl.innerHTML = `
    <header class="dash-header">
      <div class="header-xr-block">
        <img src="https://d108xxen99ni2a.cloudfront.net/XenRealitylogo.webp" alt="XenReality" />
      </div>
      <div class="header-title">PoC Dashboard</div>
      <div class="header-right">
        <span class="header-status">Live</span>
        <span class="header-clock" id="hdr-clock"></span>
      </div>
    </header>
    <div class="dash-body">
      <div class="loading-screen">
        <div class="spinner"></div>
        <p>Loading dashboard data…</p>
      </div>
    </div>
  `;

  // Clock
  const clockEl = appEl.querySelector('#hdr-clock');
  function tickClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }
  tickClock();
  setInterval(tickClock, 1000);

  // Load data
  let data;
  try {
    data = await loadAllData();
  } catch (e) {
    appEl.querySelector('.dash-body').innerHTML = `
      <div class="loading-screen">
        <p style="color:#ef4444;text-align:center;max-width:480px">
          Failed to load: ${e.message}<br><br>
          Make sure <code>events.db</code> and <code>events_2.db</code> are uploaded to
          S3 at <code>xenreality-ar/Safeer/</code>.
        </p>
      </div>`;
    return;
  }

  const allEvents  = [...data.cam1, ...data.cam2];
  const totalAll   = allEvents.length;
  const scannedAll = allEvents.filter(e => e.scanned).length;
  const suspAll    = totalAll - scannedAll;
  const rateAll    = totalAll ? Math.round((scannedAll / totalAll) * 100) : 0;
  const rateColor  = rateAll >= 90 ? '#10B981' : rateAll >= 75 ? '#F59E0B' : '#EF4444';

  const suspiciousAll = [
    ...data.cam1.filter(e => !e.scanned).map(e => ({ ...e, cam: 1 })),
    ...data.cam2.filter(e => !e.scanned).map(e => ({ ...e, cam: 2 })),
  ].sort((a, b) => a.time_seconds - b.time_seconds);

  appEl.querySelector('.dash-body').innerHTML = `
    ${suspAll > 0 ? `
      <div class="alert-banner">
        ⚠&nbsp; ${suspAll} item${suspAll !== 1 ? 's' : ''} not scanned across both cameras
      </div>` : ''}

    <!-- Combined KPIs -->
    <div class="kpi-section">
      <div class="kpi-grid-4">
        <div class="kpi-card" style="--kpi-color:#003087">
          <div class="kpi-label">Total Items</div>
          <div class="kpi-value">${totalAll}</div>
          <div class="kpi-sub">both cameras</div>
        </div>
        <div class="kpi-card" style="--kpi-color:#10B981">
          <div class="kpi-label">Scanned</div>
          <div class="kpi-value">${scannedAll}</div>
          <div class="kpi-sub">correctly processed</div>
        </div>
        <div class="kpi-card" style="--kpi-color:${suspAll > 0 ? '#EF4444' : '#10B981'}">
          <div class="kpi-label">Not Scanned</div>
          <div class="kpi-value">${suspAll}</div>
          <div class="kpi-sub">${suspAll > 0 ? '⚠ suspicious' : 'none detected'}</div>
        </div>
        <div class="kpi-card" style="--kpi-color:${rateColor}">
          <div class="kpi-label">Compliance</div>
          <div class="kpi-value">${rateAll}%</div>
          <div class="kpi-sub">scan rate</div>
        </div>
      </div>
    </div>

    <!-- Both cameras -->
    <div class="cameras-section">
      <div class="cameras-grid">
        ${CAMERAS.map((cam, i) => buildCameraCard(cam, i === 0 ? data.cam1 : data.cam2)).join('')}
      </div>
    </div>

    <!-- Suspicious items -->
    ${suspiciousAll.length > 0 ? `
      <div class="suspicious-section">
        <div class="section-label suspicious-label">⚠ Suspicious Items — Not Scanned</div>
        <div class="suspicious-list">
          ${suspiciousAll.map(ev => `
            <div class="sus-item">
              <span class="sus-cam">Camera ${ev.cam}</span>
              <span class="sus-time">${ev.time}</span>
              <span class="badge badge-unscanned">✗ Not Scanned</span>
            </div>`).join('')}
        </div>
      </div>` : ''}
  `;

  // Wire up both camera videos
  CAMERAS.forEach((cam, i) => {
    const events  = i === 0 ? data.cam1 : data.cam2;
    const videoEl = appEl.querySelector(`#vid-cam${cam.id}`);
    wireCamera(cam.id, videoEl, events, appEl);
  });
}

// ── camera card HTML ──────────────────────────────────────────────────────────

function buildCameraCard(cam, events) {
  const total    = events.length;
  const scanned  = events.filter(e => e.scanned).length;
  const unscanned = total - scanned;
  const rate     = total ? Math.round((scanned / total) * 100) : 0;
  const rc       = rate >= 90 ? '#10B981' : rate >= 75 ? '#F59E0B' : '#EF4444';

  return `
    <div class="camera-card">
      <div class="camera-title">${cam.label}</div>
      <div class="video-wrap">
        <video id="vid-cam${cam.id}" controls preload="metadata">
          <source src="${cam.video}" type="video/mp4" />
        </video>
      </div>
      <div class="cam-kpi-row">
        <div class="cam-kpi" style="--kpi-color:#003087">
          <div class="cam-kpi-val" id="cam${cam.id}-total">0</div>
          <div class="cam-kpi-lbl">Items So Far</div>
        </div>
        <div class="cam-kpi" style="--kpi-color:#10B981">
          <div class="cam-kpi-val" id="cam${cam.id}-scanned">0</div>
          <div class="cam-kpi-lbl">Scanned</div>
        </div>
        <div class="cam-kpi" style="--kpi-color:#EF4444">
          <div class="cam-kpi-val" id="cam${cam.id}-unscanned">0</div>
          <div class="cam-kpi-lbl">Not Scanned</div>
        </div>
      </div>
      <div class="events-wrap">
        <table class="events-table">
          <thead>
            <tr><th>#</th><th>Time</th><th>Status</th></tr>
          </thead>
          <tbody id="cam${cam.id}-tbody">
            ${events.map((ev, i) => `
              <tr data-idx="${i}" data-secs="${ev.time_seconds}" class="row-future">
                <td>${i + 1}</td>
                <td class="time-mono">${ev.time}</td>
                <td><span class="badge ${ev.scanned ? 'badge-scanned' : 'badge-unscanned'}">
                  ${ev.scanned ? '✓ Scanned' : '✗ Not Scanned'}
                </span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ── video → KPI sync ──────────────────────────────────────────────────────────

function wireCamera(camId, videoEl, events, appEl) {
  if (!videoEl) return;

  const totalEl    = appEl.querySelector(`#cam${camId}-total`);
  const scannedEl  = appEl.querySelector(`#cam${camId}-scanned`);
  const unscannedEl= appEl.querySelector(`#cam${camId}-unscanned`);
  const tbody      = appEl.querySelector(`#cam${camId}-tbody`);
  const rows       = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];

  videoEl.addEventListener('timeupdate', () => {
    const t = videoEl.currentTime;
    let sc = 0, un = 0, activeIdx = -1;

    events.forEach((ev, i) => {
      if (ev.time_seconds <= t) {
        if (ev.scanned) sc++; else un++;
        activeIdx = i;
      }
    });

    totalEl.textContent    = sc + un;
    scannedEl.textContent  = sc;
    unscannedEl.textContent= un;

    rows.forEach((row, i) => {
      const secs = Number(row.dataset.secs);
      row.classList.toggle('row-active',  i === activeIdx);
      row.classList.toggle('row-future',  secs > t);
    });

    // Scroll active row into view
    if (activeIdx >= 0 && rows[activeIdx]) {
      rows[activeIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });

  // Click row → seek video
  rows.forEach(row => {
    row.addEventListener('click', () => {
      videoEl.currentTime = Number(row.dataset.secs);
      videoEl.play().catch(() => {});
    });
  });
}
