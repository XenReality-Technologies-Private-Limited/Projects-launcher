import { MultiSeriesGraph, TimeSeriesGraph } from './graph.js';

const CF = 'https://d2uimaqek2eby3.cloudfront.net/Gravity';

const IST_OPTS = { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' };
function formatIST() { return new Date().toLocaleTimeString('en-IN', IST_OPTS); }
function formatSecs(s) {
  const t = Math.round(s || 0);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function attachResizeObserver(canvas, renderFn) {
  const ro = new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    renderFn();
  });
  ro.observe(canvas);
}

// ── Card builder ──────────────────────────────────────────────────────────────
function makeCard(title, iconSvg, camLabel, videoUrl, rightHtml) {
  const sec = document.createElement('section');
  sec.className = 'kpi-card';
  sec.innerHTML = `
    <div class="kpi-header">
      <div class="kpi-title-wrap">
        <span class="kpi-title-icon">${iconSvg}</span>
        <h2 class="kpi-title">${title}</h2>
      </div>
      <span class="kpi-badge">ACTIVE</span>
    </div>
    <div class="kpi-body">
      <div class="kpi-video-container">
        <span class="kpi-video-label">${camLabel}</span>
        <video class="kpi-video" src="${videoUrl}" controls muted playsinline autoplay loop></video>
      </div>
      <div class="kpi-right">${rightHtml}</div>
    </div>`;
  return sec;
}

// ── 1. Store Entrance ─────────────────────────────────────────────────────────
function buildStoreEntrance(data) {
  const icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
  const yMax = Math.max(...data.maleSeries, ...data.femaleSeries, ...data.childSeries, 1);

  const sec = makeCard('Store Entrance', icon, 'CAM-01', `${CF}/store_entrance_annotated.mp4`, `
    <div class="kpi-metric-label">TOTAL FOOTFALL</div>
    <div class="kpi-metric-value" id="se-total">--</div>
    <div class="demographic-row">
      <div><div class="demo-label" style="color:#3b82f6">&#9632; MALE</div><div class="demo-value" id="se-male">--</div></div>
      <div><div class="demo-label" style="color:#ec4899">&#9632; FEMALE</div><div class="demo-value" id="se-female">--</div></div>
      <div><div class="demo-label" style="color:#f59e0b">&#9632; CHILD</div><div class="demo-value" id="se-child">--</div></div>
    </div>
    <canvas class="kpi-graph" id="se-graph" width="600" height="120"></canvas>
    <div class="kpi-legend">Blue: Male &middot; Pink: Female &middot; Yellow: Child</div>
  `);

  const video   = sec.querySelector('.kpi-video');
  const graph   = new MultiSeriesGraph(sec.querySelector('#se-graph'), {
    series: [
      { values: data.maleSeries,   color: '#3b82f6' },
      { values: data.femaleSeries, color: '#ec4899' },
      { values: data.childSeries,  color: '#f59e0b' },
    ],
    yMax,
  });
  attachResizeObserver(sec.querySelector('#se-graph'), () => graph.render());

  video.addEventListener('timeupdate', () => {
    const idx = Math.min(Math.floor(video.currentTime), data.rows.length - 1);
    const row = data.rows[idx] || {};
    const m = row.male || 0, f = row.female || 0, c = row.child || 0;
    sec.querySelector('#se-total').textContent  = m + f + c;
    sec.querySelector('#se-male').textContent   = m;
    sec.querySelector('#se-female').textContent = f;
    sec.querySelector('#se-child').textContent  = c;
    graph.setCurrentIndex(idx);
    graph.render();
  });

  return sec;
}

// ── 2. Zone Dwell Time ────────────────────────────────────────────────────────
function buildZoneDwellTime(data) {
  const icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  const yMax = Math.max(...data.peopleSeries, 1);

  const sec = makeCard('Zone Dwell Time', icon, 'CAM-02', `${CF}/zone_dwell_time_annotated.mp4`, `
    <div class="kpi-metric-label">PEOPLE IN ZONE</div>
    <div class="kpi-metric-value" id="zd-people">--</div>
    <div class="kpi-metric-label">DWELL TIME</div>
    <div class="kpi-metric-value" id="zd-dwell">--:--</div>
    <div style="font-size:0.65em;color:#9ca3af;letter-spacing:0.05em;margin-top:-4px;">Minutes : Seconds</div>
    <canvas class="kpi-graph" id="zd-graph" width="600" height="120"></canvas>
    <div class="kpi-legend">People currently in zone</div>
  `);

  const video = sec.querySelector('.kpi-video');
  const graph = new TimeSeriesGraph(sec.querySelector('#zd-graph'), { lineColor: '#10b981', yMax });
  graph.setValues(data.peopleSeries);
  attachResizeObserver(sec.querySelector('#zd-graph'), () => graph.render());

  video.addEventListener('timeupdate', () => {
    const idx = Math.min(Math.floor(video.currentTime), data.rows.length - 1);
    const row = data.rows[idx] || {};
    sec.querySelector('#zd-people').textContent = row.people_in_zone ?? '--';
    sec.querySelector('#zd-dwell').textContent  = formatSecs(row.total_dwell_time_s);
    graph.setCurrentIndex(idx);
    graph.render();
  });

  return sec;
}

// ── 3. Vest Compliance Alert ──────────────────────────────────────────────────
function buildVestCompliance(data) {
  const icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  const yMax = Math.max(...data.alertSeries, 1);

  const sec = makeCard('Vest Compliance Alert', icon, 'CAM-03', `${CF}/vest_compliance_alert_annotated.mp4`, `
    <div class="kpi-metric-label">TOTAL ALERTS</div>
    <div class="kpi-metric-value alert-value" id="vc-alerts">--</div>
    <canvas class="kpi-graph" id="vc-graph" width="600" height="120"></canvas>
    <div class="kpi-legend">Cumulative vest compliance alerts</div>
  `);

  const video = sec.querySelector('.kpi-video');
  const graph = new TimeSeriesGraph(sec.querySelector('#vc-graph'), { lineColor: '#ef4444', yMax });
  graph.setValues(data.alertSeries);
  attachResizeObserver(sec.querySelector('#vc-graph'), () => graph.render());

  video.addEventListener('timeupdate', () => {
    const idx = Math.min(Math.floor(video.currentTime), data.rows.length - 1);
    const row = data.rows[idx] || {};
    sec.querySelector('#vc-alerts').textContent = row.total_alerts ?? '--';
    graph.setCurrentIndex(idx);
    graph.render();
  });

  return sec;
}

// ── 4. Floor Heatmap ──────────────────────────────────────────────────────────
function buildFloorHeatmap() {
  const icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`;

  const STOPS = [
    { color: '#3b82f6', label: 'Cold',     sub: 'Minimal activity' },
    { color: '#06b6d4', label: 'Cool',     sub: 'Low traffic' },
    { color: '#22c55e', label: 'Moderate', sub: 'Average footfall' },
    { color: '#eab308', label: 'Warm',     sub: 'Active zone' },
    { color: '#f97316', label: 'Hot',      sub: 'High traffic' },
    { color: '#ef4444', label: 'Peak',     sub: 'Maximum concentration' },
  ];

  const dotsHtml = STOPS.map(s => `
    <div class="hm-stop">
      <div class="hm-dot" style="background:${s.color}"></div>
      <div class="hm-stop-label">${s.label}</div>
      <div class="hm-stop-sub">${s.sub}</div>
    </div>`).join('');

  const sec = makeCard('Floor Heatmap', icon, 'CAM-04', `${CF}/floor_heatmap_annotated.mp4`, `
    <div class="heatmap-guide">
      <div class="hm-title">Heat Map Guide</div>
      <div class="hm-subtitle">COLOUR INTENSITY INDICATES RELATIVE FOOT TRAFFIC CONCENTRATION AT EACH ZONE</div>
      <div class="hm-bar"></div>
      <div class="hm-stops">${dotsHtml}</div>
    </div>
  `);

  return sec;
}

// ── Main render ───────────────────────────────────────────────────────────────
export function renderDashboard(appEl, allData) {
  appEl.innerHTML = `
    <header class="dashboard-header">
      <div class="header-logo">
        <img src="/xenlogo.png" alt="XenReality" class="header-logo-img" />
      </div>
      <span class="header-brand-name">Gravity PoC Dashboard</span>
      <div class="header-right">
        <span class="header-status">SYSTEM ONLINE</span>
        <span class="header-clock" id="ist-clock">--:--:--</span>
      </div>
    </header>
    <main class="dashboard-main" id="dashboard-main"></main>
  `;

  const main = appEl.querySelector('#dashboard-main');
  main.appendChild(buildStoreEntrance(allData.storeEntrance));
  main.appendChild(buildZoneDwellTime(allData.zoneDwellTime));
  main.appendChild(buildVestCompliance(allData.vestCompliance));
  main.appendChild(buildFloorHeatmap());

  setInterval(() => {
    const el = document.getElementById('ist-clock');
    if (el) el.textContent = formatIST();
  }, 1000);
}
