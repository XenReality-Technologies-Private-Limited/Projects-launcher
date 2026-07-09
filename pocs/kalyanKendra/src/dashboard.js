import { TimeSeriesGraph, MultiSeriesGraph } from './graph.js';

// ── Helpers ───────────────────────────────────────────────────────────────

const IST_OPTS = { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' };
function formatISTTime() { return new Date().toLocaleTimeString('en-IN', IST_OPTS); }

function formatSecs(s) {
  const t = Math.round(s || 0);
  return `${Math.floor(t / 60).toString().padStart(2, '0')}:${(t % 60).toString().padStart(2, '0')}`;
}


// Each second of the compressed video corresponds to one DB row (1 row/sec).
// video.currentTime (0–N seconds) maps directly to row index.
function rowIdx(rows, currentTime) {
  return Math.min(Math.floor(currentTime || 0), rows.length - 1);
}

function attachResizeObserver(canvas, graph) {
  const ro = new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    canvas.width  = rect.width  * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    graph.render();
  });
  ro.observe(canvas);
  return ro;
}

// ── SVG Icons ─────────────────────────────────────────────────────────────

const ICON_FOOTFALL = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="9" cy="7" r="2"/><path d="M3 22v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
  <circle cx="17" cy="7" r="2"/><path d="M13 22v-2a4 4 0 0 1 4-4h2"/>
</svg>`;

const ICON_GREETINGS = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M17 8h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2v4l-4-4H9a1.994 1.994 0 0 1-1.414-.586"/>
  <path d="M3 4h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 4V6a2 2 0 0 1 2-2z"/>
</svg>`;

const ICON_PANTRY = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
  <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
</svg>`;

const ICON_TRIALS = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/>
</svg>`;

// ── Card 1: Footfall ──────────────────────────────────────────────────────

function buildFootfallCard(cam, data) {
  const card = document.createElement('div');
  card.className = 'kpi-card';

  card.innerHTML = `
    <div class="kpi-header">
      <div class="kpi-title-wrap">
        <span class="kpi-title-icon">${ICON_FOOTFALL}</span>
        <h2 class="kpi-title">Footfall</h2>
      </div>
      <span class="kpi-badge">CAM 1</span>
    </div>
    <div class="kpi-body">
      <div class="kpi-video-container">
        <span class="kpi-video-label">${cam.label}</span>
        <video class="kpi-video" muted playsinline controls autoplay loop></video>
      </div>
      <div class="kpi-right">
        <div class="kpi-metric-label">Total Footfall</div>
        <div class="presence-pair">
          <div>
            <div class="kpi-metric-value" id="ff-total-in">0</div>
            <div class="kpi-metric-sub">Entered</div>
          </div>
          <div>
            <div class="kpi-metric-value" id="ff-total-out">0</div>
            <div class="kpi-metric-sub">Exited</div>
          </div>
        </div>
        <div class="kpi-divider"></div>
        <div class="kpi-metric-label">Avg Dwell Time</div>
        <div class="kpi-metric-value" id="ff-dwell" style="font-size:1.6rem">00:00</div>
        <div class="kpi-metric-sub">MM:SS</div>
        <canvas class="kpi-graph" id="ff-graph"></canvas>
        <div class="kpi-legend">
          <span style="color:#2563eb">&#9632; Male</span>
          <span style="color:#ec4899">&#9632; Female</span>
          <span style="color:#f59e0b">&#9632; Child</span>
        </div>
      </div>
    </div>`;

  const video     = card.querySelector('.kpi-video');
  const totalInEl = card.querySelector('#ff-total-in');
  const totalOutEl= card.querySelector('#ff-total-out');
  const dwellEl   = card.querySelector('#ff-dwell');
  const canvas    = card.querySelector('#ff-graph');

  video.src = cam.videoUrl;

  if (!data || !data.rows.length) return card;

  const { rows, maleInSeries, femaleInSeries, childInSeries } = data;
  const yMax = Math.max(...maleInSeries, ...femaleInSeries, ...childInSeries, 1);

  const graph = new MultiSeriesGraph(canvas, { yMax: Math.ceil(yMax * 1.2) || 1, playheadColor: '#6b7280', showLiveCount: true });
  graph.setSeries([
    { values: maleInSeries,   color: '#2563eb' },
    { values: femaleInSeries, color: '#ec4899' },
    { values: childInSeries,  color: '#f59e0b' },
  ]);
  attachResizeObserver(canvas, graph);

  function update() {
    const idx = rowIdx(rows, video.currentTime);
    const row = rows[idx];
    totalInEl.textContent  = String(row.totalIn);
    totalOutEl.textContent = String(row.totalOut);
    dwellEl.textContent = formatSecs(row.avg_dwell_time);
    graph.setCurrentIndex(idx);
    graph.render();
  }

  video.addEventListener('timeupdate', update);
  video.addEventListener('loadedmetadata', update);

  return card;
}

// ── Card 2: Greetings ─────────────────────────────────────────────────────

function buildGreetingsCard(cam, data) {
  const card = document.createElement('div');
  card.className = 'kpi-card';

  card.innerHTML = `
    <div class="kpi-header">
      <div class="kpi-title-wrap">
        <span class="kpi-title-icon">${ICON_GREETINGS}</span>
        <h2 class="kpi-title">Greetings</h2>
      </div>
      <span class="kpi-badge">CAM 2</span>
    </div>
    <div class="kpi-body">
      <div class="kpi-video-container">
        <span class="kpi-video-label">${cam.label}</span>
        <video class="kpi-video" muted playsinline controls autoplay loop></video>
      </div>
      <div class="kpi-right">
        <div class="presence-pair">
          <div>
            <div class="kpi-metric-label">Greeted</div>
            <div class="kpi-metric-value" id="gr-greeted" style="color:#10b981">0</div>
          </div>
          <div>
            <div class="kpi-metric-label">Unattended</div>
            <div class="kpi-metric-value" id="gr-unattended" style="color:#ef4444">0</div>
          </div>
        </div>
        <canvas class="kpi-graph" id="gr-graph"></canvas>
        <div class="kpi-legend">
          <span style="color:#10b981">&#9632; Greeted</span>
          <span style="color:#ef4444">&#9632; Unattended</span>
        </div>
      </div>
    </div>`;

  const video       = card.querySelector('.kpi-video');
  const greetedEl   = card.querySelector('#gr-greeted');
  const unattendedEl= card.querySelector('#gr-unattended');
  const canvas      = card.querySelector('#gr-graph');

  video.src = cam.videoUrl;

  if (!data || !data.rows.length) return card;

  const { rows, greetedSeries, unattendedSeries } = data;
  const yMax = Math.max(...greetedSeries, ...unattendedSeries, 1);

  const graph = new MultiSeriesGraph(canvas, { yMax: Math.ceil(yMax * 1.2) || 1, playheadColor: '#6b7280', showLiveCount: true });
  graph.setSeries([
    { values: greetedSeries,    color: '#10b981' },
    { values: unattendedSeries, color: '#ef4444' },
  ]);
  attachResizeObserver(canvas, graph);

  function update() {
    const idx = rowIdx(rows, video.currentTime);
    const row = rows[idx];
    greetedEl.textContent    = String(row.greeted);
    unattendedEl.textContent = String(row.unattended);
    graph.setCurrentIndex(idx);
    graph.render();
  }

  video.addEventListener('timeupdate', update);
  video.addEventListener('loadedmetadata', update);

  return card;
}

// ── Card 3: Pantry ────────────────────────────────────────────────────────

function buildPantryCard(cam, data) {
  const card = document.createElement('div');
  card.className = 'kpi-card';

  card.innerHTML = `
    <div class="kpi-header">
      <div class="kpi-title-wrap">
        <span class="kpi-title-icon">${ICON_PANTRY}</span>
        <h2 class="kpi-title">Pantry Zone</h2>
      </div>
      <span class="kpi-badge">CAM 3</span>
    </div>
    <div class="kpi-body">
      <div class="kpi-video-container">
        <span class="kpi-video-label">${cam.label}</span>
        <video class="kpi-video" muted playsinline controls autoplay loop></video>
      </div>
      <div class="kpi-right">
        <div class="kpi-metric-label">Employees in Zone</div>
        <div class="kpi-metric-value" id="pa-emp">0</div>
        <div class="kpi-metric-sub">currently present</div>
        <div class="kpi-divider"></div>
        <div class="kpi-metric-label">Total Pantry Time</div>
        <div class="kpi-metric-value" id="pa-time" style="font-size:1.6rem">00:00</div>
        <div class="kpi-metric-sub">MM:SS cumulative time in zone</div>
        <canvas class="kpi-graph" id="pa-graph"></canvas>
        <div class="kpi-legend">
          <span style="color:#f97316">&#9632; Employee count over time</span>
        </div>
      </div>
    </div>`;

  const video  = card.querySelector('.kpi-video');
  const empEl  = card.querySelector('#pa-emp');
  const timeEl = card.querySelector('#pa-time');
  const canvas = card.querySelector('#pa-graph');

  video.src = cam.videoUrl;

  if (!data || !data.rows.length) return card;

  const { rows, employeeInZoneSeries } = data;
  const yMax = Math.max(...employeeInZoneSeries, 5);

  const graph = new TimeSeriesGraph(canvas, { lineColor: '#f97316', yMax: Math.ceil(yMax * 1.2) || 5, playheadColor: '#6b7280', showLiveCount: true });
  graph.setValues(employeeInZoneSeries);
  attachResizeObserver(canvas, graph);

  function update() {
    const idx = rowIdx(rows, video.currentTime);
    const row = rows[idx];
    empEl.textContent  = String(row.employee_in_zone);
    timeEl.textContent = formatSecs(row.total_pantry_time);
    graph.setCurrentIndex(idx);
    graph.render();
  }

  video.addEventListener('timeupdate', update);
  video.addEventListener('loadedmetadata', update);

  return card;
}

// ── Card 4: Trial Room ────────────────────────────────────────────────────

function buildTrialRoomCard(cam, data) {
  const card = document.createElement('div');
  card.className = 'kpi-card';

  card.innerHTML = `
    <div class="kpi-header">
      <div class="kpi-title-wrap">
        <span class="kpi-title-icon">${ICON_TRIALS}</span>
        <h2 class="kpi-title">Trial Room</h2>
      </div>
      <span class="kpi-badge">CAM 4</span>
    </div>
    <div class="kpi-body">
      <div class="kpi-video-container">
        <span class="kpi-video-label">${cam.label}</span>
        <video class="kpi-video" muted playsinline controls autoplay loop></video>
      </div>
      <div class="kpi-right">
        <div class="presence-pair">
          <div>
            <div class="kpi-metric-label">Customers In</div>
            <div class="kpi-metric-value" id="tr-cust-in">0</div>
          </div>
          <div>
            <div class="kpi-metric-label">Employees In</div>
            <div class="kpi-metric-value" id="tr-emp-in">0</div>
          </div>
        </div>
        <div class="kpi-metric-label">Avg Dwell Time</div>
        <div class="kpi-metric-value" id="tr-dwell" style="font-size:1.6rem">00:00</div>
        <div class="kpi-metric-sub">MM:SS</div>
        <div class="kpi-divider"></div>
        <div class="kpi-metric-label">Employee-Only Time</div>
        <div class="kpi-metric-value" id="tr-emp-only" style="font-size:1.6rem;color:#f97316">00:00</div>
        <div class="kpi-metric-sub">MM:SS employee in room without customer</div>
        <canvas class="kpi-graph" id="tr-graph"></canvas>
        <div class="kpi-legend">
          <span style="color:#8b5cf6">&#9632; Customer count in trial room</span>
        </div>
      </div>
    </div>`;

  const video     = card.querySelector('.kpi-video');
  const custInEl  = card.querySelector('#tr-cust-in');
  const empInEl   = card.querySelector('#tr-emp-in');
  const dwellEl   = card.querySelector('#tr-dwell');
  const empOnlyEl = card.querySelector('#tr-emp-only');
  const canvas    = card.querySelector('#tr-graph');

  video.src = cam.videoUrl;

  if (!data || !data.rows.length) return card;

  const { rows, customerInSeries } = data;
  const yMax = Math.max(...customerInSeries, 5);

  const graph = new TimeSeriesGraph(canvas, { lineColor: '#8b5cf6', yMax: Math.ceil(yMax * 1.2) || 5, playheadColor: '#6b7280', showLiveCount: true });
  graph.setValues(customerInSeries);
  attachResizeObserver(canvas, graph);

  function update() {
    const idx = rowIdx(rows, video.currentTime);
    const row = rows[idx];
    custInEl.textContent  = String(row.customer_in);
    empInEl.textContent   = String(row.employee_in);
    dwellEl.textContent   = formatSecs(row.avg_dwell_time);
    empOnlyEl.textContent = formatSecs(row.cumEmployeeOnlySecs);
    graph.setCurrentIndex(idx);
    graph.render();
  }

  video.addEventListener('timeupdate', update);
  video.addEventListener('loadedmetadata', update);

  return card;
}

// ── Main render ───────────────────────────────────────────────────────────

export async function renderDashboard(appEl, cameras, allData) {
  appEl.innerHTML = `
    <header class="dashboard-header">
      <div class="header-logo">
        <img src="/xenlogo.png" alt="XenReality" class="header-logo-img" />
        <span class="header-brand-name">Kalyan Kendra</span>
      </div>
      <div class="header-center">
        <span class="header-title">PoC Dashboard</span>
      </div>
      <div class="header-right">
        <span class="header-status">&#9679;&nbsp;System Online</span>
        <span class="header-clock" id="ist-clock">--:--:--</span>
      </div>
    </header>
    <main class="dashboard-main" id="kpi-main"></main>`;

  const clockEl = appEl.querySelector('#ist-clock');
  clockEl.textContent = formatISTTime();
  setInterval(() => { clockEl.textContent = formatISTTime(); }, 1000);

  const main = appEl.querySelector('#kpi-main');

  const builders = [buildFootfallCard, buildGreetingsCard, buildPantryCard, buildTrialRoomCard];
  const dataKeys = ['footfall', 'greetings', 'pantry', 'trials'];

  cameras.forEach((cam, i) => {
    const kpiData = allData ? allData[dataKeys[i]] : null;
    main.appendChild(builders[i](cam, kpiData));
  });
}
