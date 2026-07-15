import { loadAllData } from './db.js';

const CF = 'https://d2uimaqek2eby3.cloudfront.net/Safeer';

const CAMERAS = [
  { id: 1, label: 'CAM-01', title: 'Self-Checkout Monitor · Camera 1', video: `${CF}/merged_1.mp4` },
  { id: 2, label: 'CAM-02', title: 'Self-Checkout Monitor · Camera 2', video: `${CF}/merged_2.mp4` },
];

const SCAN_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5v4M3 5h4M21 5h-4M21 5v4M3 19v-4M3 19h4M21 19h-4M21 19v-4M8 12h8"/></svg>`;

export async function initDashboard(appEl) {
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
    <div class="dashboard-main" id="dash-main">
      <div class="kpi-loading"><div class="spinner"></div>Loading dashboard data…</div>
    </div>
  `;

  const clockEl = appEl.querySelector('#hdr-clock');
  function tickClock() {
    clockEl.textContent = new Date().toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }
  tickClock();
  setInterval(tickClock, 1000);

  const mainEl = appEl.querySelector('#dash-main');

  let data;
  try {
    data = await loadAllData();
  } catch (e) {
    mainEl.innerHTML = `
      <div class="kpi-loading" style="flex-direction:column;gap:8px">
        <p style="color:#ef4444;text-align:center;max-width:480px;margin:0">
          Failed to load data: ${e.message}
        </p>
        <p style="color:#6b7280;font-size:0.82rem;text-align:center;max-width:480px;margin:0">
          Upload <code>events.db</code> and <code>events_2.db</code> to
          <code>xenreality-ar/Safeer/</code> on S3.
        </p>
      </div>`;
    return;
  }

  const camEvents = [data.cam1, data.cam2];

  mainEl.innerHTML = CAMERAS.map(cam => buildShell(cam)).join('');

  CAMERAS.forEach((cam, i) => {
    const videoEl = appEl.querySelector(`#vid-cam${cam.id}`);
    wireCamera(cam.id, videoEl, camEvents[i], appEl);
  });
}

function buildShell(cam) {
  return `
    <section class="kpi-card">
      <div class="kpi-header">
        <div class="kpi-title-wrap">
          <span class="kpi-title-icon">${SCAN_ICON}</span>
          <h2 class="kpi-title">${cam.title}</h2>
        </div>
        <div class="badge-row header-badges">
          <span class="badge badge-present">Active</span>
        </div>
      </div>
      <div class="kpi-body">
        <div class="kpi-video-container">
          <span class="kpi-video-label">${cam.label}</span>
          <video id="vid-cam${cam.id}" class="kpi-video" controls muted playsinline>
            <source src="${cam.video}" type="video/mp4" />
          </video>
        </div>
        <div class="kpi-right">
          <div class="kpi-metric-label">Total Items</div>
          <div class="kpi-metric-value" id="cam${cam.id}-total">0</div>
          <div class="kpi-metrics-row">
            <div>
              <div class="kpi-metric-label">Scanned</div>
              <div class="kpi-metric-value" id="cam${cam.id}-scanned" style="color:#10b981">0</div>
            </div>
            <div>
              <div class="kpi-metric-label">Not Scanned</div>
              <div class="kpi-metric-value" id="cam${cam.id}-unscanned" style="color:#ef4444">0</div>
            </div>
          </div>
          <div class="kpi-divider"></div>
          <div class="kpi-metric-label">Events</div>
          <div class="txn-table-wrap" id="cam${cam.id}-wrap">
            <table class="txn-table">
              <thead><tr><th>#</th><th>Time</th><th>Status</th></tr></thead>
              <tbody id="cam${cam.id}-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    </section>`;
}

function makeRow(ev, idx, videoEl) {
  const tr = document.createElement('tr');
  tr.dataset.secs = ev.time_seconds;
  tr.innerHTML = `
    <td>${idx + 1}</td>
    <td class="txn-time">${ev.time}</td>
    <td class="${ev.scanned ? 'txn-ok' : 'txn-alert'}">${ev.scanned ? '✓ Scanned' : '✗ Not Scanned'}</td>`;
  tr.addEventListener('click', () => {
    videoEl.currentTime = ev.time_seconds;
    videoEl.play().catch(() => {});
  });
  return tr;
}

function wireCamera(camId, videoEl, events, appEl) {
  if (!videoEl) return;

  const totalEl     = appEl.querySelector(`#cam${camId}-total`);
  const scannedEl   = appEl.querySelector(`#cam${camId}-scanned`);
  const unscannedEl = appEl.querySelector(`#cam${camId}-unscanned`);
  const tbody       = appEl.querySelector(`#cam${camId}-tbody`);
  const tableWrap   = appEl.querySelector(`#cam${camId}-wrap`);

  // Fix scroll-trap: pass wheel through to page when table is at boundary or has no overflow
  tableWrap.addEventListener('wheel', (e) => {
    const { scrollTop, scrollHeight, clientHeight } = tableWrap;
    const noScroll = scrollHeight <= clientHeight;
    const atTop    = scrollTop <= 0 && e.deltaY < 0;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 1 && e.deltaY > 0;
    if (noScroll || atTop || atBottom) {
      e.preventDefault();
      window.scrollBy({ top: e.deltaY, behavior: 'auto' });
    }
  }, { passive: false });

  let shownCount = 0;

  videoEl.addEventListener('timeupdate', () => {
    const t = videoEl.currentTime;
    let sc = 0, un = 0;
    let visibleCount = 0;

    events.forEach(ev => {
      if (ev.time_seconds <= t) {
        visibleCount++;
        if (ev.scanned) sc++; else un++;
      }
    });

    totalEl.textContent     = sc + un;
    scannedEl.textContent   = sc;
    unscannedEl.textContent = un;

    if (visibleCount === shownCount) return;

    if (visibleCount < shownCount) {
      // Seeking backward — rebuild from scratch
      tbody.innerHTML = '';
      for (let i = 0; i < visibleCount; i++) {
        tbody.appendChild(makeRow(events[i], i, videoEl));
      }
    } else {
      // New events — append only the new ones
      for (let i = shownCount; i < visibleCount; i++) {
        tbody.appendChild(makeRow(events[i], i, videoEl));
      }
    }

    shownCount = visibleCount;

    // Highlight the last row and scroll it into view
    const allRows = tbody.querySelectorAll('tr');
    allRows.forEach((r, i) => r.classList.toggle('row-active', i === allRows.length - 1));
    if (allRows.length > 0) {
      allRows[allRows.length - 1].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
}
