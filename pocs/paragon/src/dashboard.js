import { TimeSeriesGraph, MultiSeriesGraph } from './graph.js';

const IST_TIME_OPTIONS = { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' };
function formatISTTime() { return new Date().toLocaleTimeString('en-IN', IST_TIME_OPTIONS); }
function formatSecs(s) {
  const t = Math.round(s || 0);
  return `${Math.floor(t / 60).toString().padStart(2, '0')}:${(t % 60).toString().padStart(2, '0')}`;
}

const ICONS = {
  footfall: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  phone:    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
  apron:    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a5 5 0 0 1 5 5v3H7V7a5 5 0 0 1 5-5z"/><path d="M7 10v10a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V10"/></svg>`,
  table:    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="9" x2="9" y2="21"/></svg>`,
  water:    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 C6 8 4 12 4 15 a8 8 0 0 0 16 0 C20 12 18 8 12 2z"/></svg>`,
};

function attachMultiGraph(canvas, series, yMax) {
  const graph = new MultiSeriesGraph(canvas, {
    series,
    yMax: Math.ceil((yMax || 5) * 1.2) || 5,
    playheadColor: '#6b7280',
    showLiveCount: true,
  });
  const ro = new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    graph.render();
  });
  ro.observe(canvas);
  return graph;
}

function attachGraph(canvas, values, color, yMax) {
  const graph = new TimeSeriesGraph(canvas, {
    yMax: Math.ceil((yMax || 5) * 1.2) || 5,
    lineColor: color,
    playheadColor: '#6b7280',
    showLiveCount: true,
  });
  graph.setValues(values);
  const ro = new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    graph.render();
  });
  ro.observe(canvas);
  return graph;
}

function buildShell(title, icon, badgeHtml, camLabel, videoUrl) {
  const section = document.createElement('section');
  section.className = 'kpi-card';
  section.innerHTML = `
    <div class="kpi-header">
      <div class="kpi-title-wrap">
        <span class="kpi-title-icon">${icon}</span>
        <h2 class="kpi-title">${title}</h2>
      </div>
      <div class="badge-row header-badges">${badgeHtml}</div>
    </div>
    <div class="kpi-body">
      <div class="kpi-video-container">
        <span class="kpi-video-label">${camLabel}</span>
        <video class="kpi-video" controls muted playsinline autoplay loop></video>
      </div>
      <div class="kpi-right" id="right-panel"></div>
    </div>`;
  section.querySelector('.kpi-video').src = videoUrl;
  return section;
}

// ── 1. Footfall ────────────────────────────────────────────────────────────
export function buildFootfallCard(cam, index, data) {
  const section = buildShell('Footfall', ICONS.footfall, '<span class="badge badge-present">Active</span>', `CAM-${String(index + 1).padStart(2, '0')}`, cam.videoUrl);
  const right = section.querySelector('#right-panel');
  right.innerHTML = `
    <div class="presence-pair">
      <div>
        <div class="kpi-metric-label">IN</div>
        <div class="kpi-metric-value" id="ff-in">0</div>
      </div>
      <div>
        <div class="kpi-metric-label">OUT</div>
        <div class="kpi-metric-value" id="ff-out">0</div>
      </div>
    </div>
    <div class="kpi-divider"></div>
    <div class="kpi-metric-label">Avg Dwell Time</div>
    <div class="kpi-metric-value" id="ff-dwell" style="font-size:1.6rem">00:00</div>
    <div class="kpi-metric-sub">MM:SS</div>
    <div class="kpi-divider"></div>
    <div class="presence-pair">
      <div>
        <div class="kpi-metric-label">Family</div>
        <div class="kpi-metric-value" id="ff-family" style="font-size:1.6rem">0</div>
      </div>
      <div>
        <div class="kpi-metric-label">Individual / Group</div>
        <div class="kpi-metric-value" id="ff-nonfamily" style="font-size:1.6rem">0</div>
      </div>
    </div>
    <div class="kpi-metric-label">IN Demographics</div>
    <canvas class="kpi-graph" id="ff-in-graph" width="600" height="120"></canvas>
    <div class="kpi-legend" style="font-size:0.7rem">
      <span style="color:#2563eb">&#9632; Male</span> &nbsp;
      <span style="color:#ec4899">&#9632; Female</span> &nbsp;
      <span style="color:#eab308">&#9632; Child</span>
    </div>
    <div class="kpi-metric-label">OUT Demographics</div>
    <canvas class="kpi-graph" id="ff-out-graph" width="600" height="120"></canvas>`;

  if (!data) return section;
  const { rows, inMaleSeries, inFemaleSeries, inChildSeries, outMaleSeries, outFemaleSeries, outChildSeries } = data;

  const inEl    = right.querySelector('#ff-in');
  const outEl   = right.querySelector('#ff-out');
  const dwellEl = right.querySelector('#ff-dwell');
  const familyEl = right.querySelector('#ff-family');
  const nonfamEl = right.querySelector('#ff-nonfamily');

  const firstExitIdx = rows.findIndex(r => r.out_count.reduce((s, v) => s + v, 0) > 0);

  const inSeries = [
    { values: inMaleSeries,   color: '#2563eb' },
    { values: inFemaleSeries, color: '#ec4899' },
    { values: inChildSeries,  color: '#eab308' },
  ];
  const outSeries = [
    { values: outMaleSeries,   color: '#2563eb' },
    { values: outFemaleSeries, color: '#ec4899' },
    { values: outChildSeries,  color: '#eab308' },
  ];

  const yMaxIn  = Math.max(5, ...inMaleSeries,  ...inFemaleSeries,  ...inChildSeries);
  const yMaxOut = Math.max(5, ...outMaleSeries, ...outFemaleSeries, ...outChildSeries);

  const inGraph  = attachMultiGraph(right.querySelector('#ff-in-graph'),  inSeries,  yMaxIn);
  const outGraph = attachMultiGraph(right.querySelector('#ff-out-graph'), outSeries, yMaxOut);

  const video = section.querySelector('.kpi-video');
  function update() {
    if (!rows.length) return;
    const idx = Math.min(Math.floor(video.currentTime || 0), rows.length - 1);
    const row = rows[idx];

    // in_count / out_count are cumulative totals — sum the array directly
    inEl.textContent  = String(row.in_count.reduce((s, v) => s + v, 0));
    outEl.textContent = String(row.out_count.reduce((s, v) => s + v, 0));
    const dwell = firstExitIdx < 0 || idx < firstExitIdx ? 0 : Math.min(idx - firstExitIdx + 1, 30);
    dwellEl.textContent = formatSecs(dwell);
    familyEl.textContent  = String(row.family_count);
    nonfamEl.textContent  = String(row.non_family_count);

    inGraph.setCurrentIndex(idx);
    inGraph.render();
    outGraph.setCurrentIndex(idx);
    outGraph.render();
  }
  video.addEventListener('loadedmetadata', update);
  video.addEventListener('timeupdate', update);
  return section;
}

// ── 2. Phone Usage ─────────────────────────────────────────────────────────
export function buildPhoneUsageCard(cam, index, data) {
  const section = buildShell('Phone Usage', ICONS.phone, '<span class="badge badge-present">Monitoring</span>', `CAM-${String(index + 1).padStart(2, '0')}`, cam.videoUrl);
  const right = section.querySelector('#right-panel');
  right.innerHTML = `
    <div class="kpi-metric-label">Employee Status</div>
    <div class="badge-row" id="pu-status-badge"></div>
    <div class="kpi-metric-label">Total Usage Time</div>
    <div class="kpi-metric-value" id="pu-total-time" style="font-size:1.6rem">00:00</div>
    <div class="kpi-metric-sub">MM:SS cumulative</div>
    <div class="kpi-divider"></div>
    <div class="kpi-metric-label">Usage Log</div>
    <div class="txn-table-wrap">
      <table class="txn-table">
        <thead><tr><th>Time</th><th>Duration</th></tr></thead>
        <tbody id="pu-log-body"><tr><td colspan="2" class="txn-empty">No sessions yet</td></tr></tbody>
      </table>
    </div>
    <div class="kpi-metric-label" style="margin-top:8px">Duration (seconds)</div>
    <canvas class="kpi-graph" id="pu-graph" width="600" height="120"></canvas>`;

  if (!data) return section;
  const { rows, usageSessions, durationSeries } = data;

  const statusBadgeEl = right.querySelector('#pu-status-badge');
  const totalTimeEl   = right.querySelector('#pu-total-time');
  const logBodyEl     = right.querySelector('#pu-log-body');

  const yMax  = Math.max(5, ...durationSeries);
  const graph = attachGraph(right.querySelector('#pu-graph'), durationSeries, '#ef4444', yMax);

  const video = section.querySelector('.kpi-video');
  function update() {
    if (!rows.length) return;
    const idx = Math.min(Math.floor(video.currentTime || 0), rows.length - 1);
    const row = rows[idx];

    const isUsingPhone = usageSessions.some(s => idx >= s.start_idx && idx <= s.end_idx);
    statusBadgeEl.innerHTML = isUsingPhone
      ? `<span class="badge badge-alert">Using Phone</span>`
      : `<span class="badge badge-present">Clear</span>`;

    // Cumulative session span seconds (matches graph)
    totalTimeEl.textContent = formatSecs(row.cumulative_usage_secs);

    // Sessions visible so far (started at or before current idx)
    const visibleSessions = usageSessions.filter((s) => s.start_idx <= idx);
    logBodyEl.innerHTML = visibleSessions.length
      ? visibleSessions.map((s) => {
          // Mirrors cumulative_usage_secs: span from start to min(idx, end)
          const dur = Math.max(0, Math.min(idx, s.end_idx) - s.start_idx);
          return `<tr>
            <td class="txn-time">${s.start_time}</td>
            <td>${formatSecs(dur)}</td>
          </tr>`;
        }).join('')
      : `<tr><td colspan="2" class="txn-empty">No sessions yet</td></tr>`;

    graph.setCurrentIndex(idx);
    graph.render();
  }
  video.addEventListener('loadedmetadata', update);
  video.addEventListener('timeupdate', update);
  return section;
}

// ── 3. Apron Check (static — no DB) ───────────────────────────────────────
export function buildApronCard(cam, index, _data) {
  const section = buildShell('Food Safety Gear (Apron and Cap)', ICONS.apron, '<span class="badge badge-present">Active</span>', `CAM-${String(index + 1).padStart(2, '0')}`, cam.videoUrl);
  const right = section.querySelector('#right-panel');
  right.innerHTML = `
    <div class="kpi-metric-label">Bounding Box Legend</div>
    <table class="apron-legend-table">
      <thead><tr><th>Colour</th><th>Meaning</th></tr></thead>
      <tbody>
        <tr>
          <td><span class="colour-dot colour-dot-green"></span> Green</td>
          <td>All OK</td>
        </tr>
        <tr>
          <td><span class="colour-dot colour-dot-yellow"></span> Yellow</td>
          <td>Partially compliant</td>
        </tr>
        <tr>
          <td><span class="colour-dot colour-dot-red"></span> Red</td>
          <td>Non-compliant</td>
        </tr>
      </tbody>
    </table>`;
  return section;
}

// ── 4. Table Cleanliness ───────────────────────────────────────────────────
export function buildTableCleanCard(cam, index, data) {
  const section = buildShell('Table Cleanliness', ICONS.table, '<span class="badge badge-present">Monitoring</span>', `CAM-${String(index + 1).padStart(2, '0')}`, cam.videoUrl);
  const right = section.querySelector('#right-panel');
  right.innerHTML = `
    <div class="kpi-metric-label">Table States</div>
    <div class="table-clean-grid">
      <div class="table-cell" id="tc-t1"><div class="table-cell-label">Table 1</div><div class="table-cell-state">--</div></div>
      <div class="table-cell" id="tc-t2"><div class="table-cell-label">Table 2</div><div class="table-cell-state">--</div></div>
      <div class="table-cell" id="tc-t3"><div class="table-cell-label">Table 3</div><div class="table-cell-state">--</div></div>
    </div>`;

  if (!data) return section;
  const { rows } = data;

  const cells = [
    right.querySelector('#tc-t1'),
    right.querySelector('#tc-t2'),
    right.querySelector('#tc-t3'),
  ];
  const video = section.querySelector('.kpi-video');

  function stateClass(state) {
    if (state === 'CLEAN')    return 'state-clean';
    if (state === 'OCCUPIED') return 'state-occupied';
    if (state === 'UNCLEAN')  return 'state-unclean';
    return '';
  }

  function update() {
    if (!rows.length) return;
    const idx = Math.min(Math.floor(video.currentTime || 0), rows.length - 1);
    const row = rows[idx];
    [row.table1_state, row.table2_state, row.table3_state].forEach((state, i) => {
      cells[i].className = `table-cell ${stateClass(state)}`;
      cells[i].querySelector('.table-cell-state').textContent = state || '--';
    });
  }
  video.addEventListener('loadedmetadata', update);
  video.addEventListener('timeupdate', update);
  return section;
}

// ── 5. Water Service ───────────────────────────────────────────────────────
export function buildWaterServiceCard(cam, index, data) {
  const section = buildShell('Water Service', ICONS.water, '<span class="badge badge-present">Active</span>', `CAM-${String(index + 1).padStart(2, '0')}`, cam.videoUrl);
  const right = section.querySelector('#right-panel');
  right.innerHTML = `
    <div class="kpi-metric-label">Customers Served Water</div>
    <div class="kpi-metric-value" id="ws-poured">0</div>
    <div class="kpi-divider"></div>
    <div class="kpi-metric-label">Wait Time Log</div>
    <div class="txn-table-wrap">
      <table class="txn-table">
        <thead><tr><th>Customer</th><th>Wait Time</th></tr></thead>
        <tbody id="ws-log-body"><tr><td colspan="2" class="txn-empty">No events yet</td></tr></tbody>
      </table>
    </div>`;

  if (!data) return section;
  const { rows, servingEvents } = data;

  const pouredEl = right.querySelector('#ws-poured');
  const logBodyEl = right.querySelector('#ws-log-body');
  const video    = section.querySelector('.kpi-video');

  function update() {
    if (!rows.length) return;
    const idx = Math.min(Math.floor(video.currentTime || 0), rows.length - 1);
    const row = rows[idx];
    pouredEl.textContent = String(row.cumulative_water_served);

    const visible = servingEvents.filter(e => Math.max(0, e.idx - e.wait_secs) <= idx);
    logBodyEl.innerHTML = visible.length
      ? visible.map((e, i) => {
          const startIdx = Math.max(0, e.idx - e.wait_secs);
          const counted  = Math.min(idx - startIdx, e.wait_secs);
          return `<tr><td>Customer ${i + 1}</td><td>${formatSecs(counted)}</td></tr>`;
        }).join('')
      : `<tr><td colspan="2" class="txn-empty">No events yet</td></tr>`;
  }
  video.addEventListener('loadedmetadata', update);
  video.addEventListener('timeupdate', update);
  return section;
}

// ── Dashboard shell + render ───────────────────────────────────────────────
export async function renderDashboard(appEl, cameras, allData) {
  appEl.innerHTML = `
    <header class="dashboard-header">
      <div class="header-logo">
        <img src="/xenlogo.png" alt="XenReality" class="header-logo-img" />
      </div>
      <span class="header-brand-name">PoC Dashboard</span>
      <div class="header-right">
        <span class="header-status">SYSTEM ONLINE</span>
        <span class="header-clock" id="ist-clock">--:--:--</span>
      </div>
    </header>
    <main class="dashboard-main" id="kpi-main"></main>`;

  const clockEl = appEl.querySelector('#ist-clock');
  clockEl.textContent = formatISTTime();
  setInterval(() => { clockEl.textContent = formatISTTime(); }, 1000);

  const main = appEl.querySelector('#kpi-main');

  const builders = {
    'footfall':      (cam, i) => buildFootfallCard(cam, i, allData?.footfall),
    'phone-usage':   (cam, i) => buildPhoneUsageCard(cam, i, allData?.phoneUsage),
    'apron':         (cam, i) => buildApronCard(cam, i, null),
    'table-clean':   (cam, i) => buildTableCleanCard(cam, i, allData?.tableClean),
    'water-service': (cam, i) => buildWaterServiceCard(cam, i, allData?.waterService),
  };

  cameras.forEach((cam, i) => {
    const builder = builders[cam.type];
    if (builder) main.appendChild(builder(cam, i));
  });
}
