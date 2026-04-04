import { TimeSeriesGraph, MultiSeriesGraph } from './graph.js';
import { loadKpiDatabase } from './db.js';

const IST_TIME_OPTIONS = {
  timeZone: 'Asia/Kolkata',
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
};

function formatISTTime() {
  return new Date().toLocaleTimeString('en-IN', IST_TIME_OPTIONS);
}

function formatTime(seconds) {
  const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
  const ss = (seconds % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

const KPI_ICONS = {
  footfall: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  passerby: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  'zone-entry': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`,
};

const KPI_LABELS = {
  footfall:    'FOOTFALL',
  passerby:   'PASSERBY',
  'zone-entry': 'ZONE ENTRY',
};

const FOOTFALL_COLORS = {
  male: '#2563eb',
  female: '#ec4899',
  child: '#eab308',
};

function buildDashboardShell(config) {
  const companyLogoHtml = config.companyLogo
    ? `<img src="${config.companyLogo}" alt="Company Logo" class="header-logo-img" style="height:36px;width:auto;object-fit:contain;" />`
    : '';

  return `
    <header class="dashboard-header">
      <div class="header-logo">
        ${companyLogoHtml}
        <img src="/xenlogo.png" alt="XenReality" class="header-logo-img" />
      </div>
      <div class="header-right">
        <button class="btn-reconfigure" id="reconfigure-btn" type="button">&#8592; Reconfigure</button>
        <span class="header-status">SYSTEM ONLINE</span>
        <span class="header-clock" id="ist-clock">--:--:--</span>
      </div>
    </header>
    <main class="dashboard-main" id="kpi-main">
      <div class="kpi-loading">
        <span>Loading KPI dashboards&hellip;</span>
      </div>
    </main>
  `;
}

function buildFootfallCard(kpi, index, dbResult) {
  const camLabel = `CAM-${String(index + 1).padStart(2, '0')}`;
  const displayTitle = kpi.label || KPI_LABELS[kpi.type] || kpi.type.toUpperCase();

  const section = document.createElement('section');
  section.className = 'kpi-card';
  section.dataset.kpiIndex = index;
  section.innerHTML = `
    <div class="kpi-header">
      <div class="kpi-title-wrap">
        <span class="kpi-title-icon" aria-hidden="true">${KPI_ICONS[kpi.type] || ''}</span>
        <h2 class="kpi-title">${displayTitle}</h2>
      </div>
      <span class="kpi-badge">ACTIVE</span>
    </div>
    <div class="kpi-body">
      <div class="kpi-video-container">
        <span class="kpi-video-label">${camLabel}</span>
        <video class="kpi-video" controls muted playsinline autoplay loop></video>
      </div>
      <div class="kpi-right">
        <div class="kpi-metric-label">${KPI_LABELS[kpi.type] || 'COUNT'}</div>
        <div class="kpi-metric-value">--</div>
        <canvas class="kpi-graph" width="600" height="160"></canvas>
        <div class="kpi-legend">
          <div>Blue: Male &middot; Pink: Female &middot; Yellow: Child</div>
        </div>
      </div>
    </div>
  `;

  // Set video src via property to avoid XSS risks with inline attribute
  const video = section.querySelector('.kpi-video');
  video.src = kpi.videoUrl;

  if (!dbResult) {
    section.querySelector('.kpi-metric-value').textContent = 'ERROR';
    return section;
  }

  const { maleSeries, femaleSeries, childSeries, rows } = dbResult.data;
  const canvas = section.querySelector('.kpi-graph');
  const metricValue = section.querySelector('.kpi-metric-value');

  const graph = new MultiSeriesGraph(canvas, {
    series: [
      { values: maleSeries,   color: FOOTFALL_COLORS.male,   label: 'Male' },
      { values: femaleSeries, color: FOOTFALL_COLORS.female, label: 'Female' },
      { values: childSeries,  color: FOOTFALL_COLORS.child,  label: 'Child' },
    ],
    yMax: 50,
    playheadColor: '#6b7280',
    showLiveCount: true,
  });

  const updateForTime = () => {
    if (!rows.length) { metricValue.textContent = '0'; graph.render(); return; }
    const idx = Math.min(Math.floor(video.currentTime || 0), rows.length - 1);
    const row = rows[idx];
    const inCount = row.in_count || [0, 0, 0];
    metricValue.textContent = String(inCount[0] + inCount[1] + inCount[2]);
    graph.setCurrentIndex(idx);
    graph.render();
  };

  const ro = new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    graph.render();
  });
  ro.observe(canvas);

  video.addEventListener('loadedmetadata', updateForTime);
  video.addEventListener('timeupdate', updateForTime);

  return section;
}

function buildZoneEntryCard(kpi, index, dbResult) {
  const camLabel = `CAM-${String(index + 1).padStart(2, '0')}`;
  const displayTitle = kpi.label || KPI_LABELS[kpi.type] || kpi.type.toUpperCase();

  const section = document.createElement('section');
  section.className = 'kpi-card';
  section.dataset.kpiIndex = index;
  section.innerHTML = `
    <div class="kpi-header">
      <div class="kpi-title-wrap">
        <span class="kpi-title-icon" aria-hidden="true">${KPI_ICONS[kpi.type] || ''}</span>
        <h2 class="kpi-title">${displayTitle}</h2>
      </div>
      <span class="kpi-employee-badge">Employee: --</span>
    </div>
    <div class="kpi-body">
      <div class="kpi-video-container">
        <span class="kpi-video-label">${camLabel}</span>
        <video class="kpi-video" controls muted playsinline autoplay loop></video>
      </div>
      <div class="kpi-right">
        <div class="kpi-metric-label">UNIQUE CUSTOMERS</div>
        <div class="kpi-metric-value">--</div>
        <canvas class="kpi-graph" width="600" height="160"></canvas>
        <div class="kpi-metric-label">INTERACTION TIME</div>
        <div class="kpi-metric-value kpi-interaction-time-value">--</div>
        <div style="font-size:0.65em;color:#9ca3af;letter-spacing:0.05em;margin-top:-4px;">Minutes : Seconds</div>
        <div class="kpi-legend"><div>Customers in zone</div></div>
      </div>
    </div>
  `;

  const video = section.querySelector('.kpi-video');
  video.src = kpi.videoUrl;

  if (!dbResult) {
    section.querySelector('.kpi-metric-value').textContent = 'ERROR';
    section.querySelector('.kpi-interaction-time-value').textContent = 'ERROR';
    return section;
  }

  const { rows } = dbResult.data;
  const canvas = section.querySelector('.kpi-graph');
  const metricValue = section.querySelector('.kpi-metric-value');
  const employeeBadge = section.querySelector('.kpi-employee-badge');
  const interactionTimeEl = section.querySelector('.kpi-interaction-time-value');

  const cumulativeUniqueSeries = rows.map(r => r.cumulativeUnique ?? 0);
  const maxUnique = cumulativeUniqueSeries.length ? Math.max(...cumulativeUniqueSeries) : 10;

  const graph = new TimeSeriesGraph(canvas, {
    yMax: Math.ceil(maxUnique * 1.2) || 10,
    lineColor: '#8b5cf6',
    playheadColor: '#6b7280',
    showLiveCount: true,
  });
  graph.setValues(cumulativeUniqueSeries);

  // Precompute cumulative interaction seconds
  const cumulativeInteraction = rows.map(((acc) => (row) => {
    acc += (row.employee === true && (row.customer ?? 0) > 0) ? 1 : 0;
    return acc;
  })(0));

  const updateForTime = () => {
    if (!rows.length) {
      metricValue.textContent = '0';
      if (employeeBadge) { employeeBadge.textContent = 'Employee: --'; employeeBadge.classList.remove('employee-present', 'employee-absent'); }
      if (interactionTimeEl) interactionTimeEl.textContent = '00:00';
      graph.render();
      return;
    }
    const idx = Math.min(Math.floor(video.currentTime || 0), rows.length - 1);
    const row = rows[idx];

    metricValue.textContent = String(row.cumulativeUnique ?? 0);

    if (employeeBadge) {
      const present = row.employee === true;
      employeeBadge.textContent = present ? 'Employee: Present' : 'Employee: Absent';
      employeeBadge.classList.toggle('employee-present', present);
      employeeBadge.classList.toggle('employee-absent', !present);
    }

    if (interactionTimeEl) {
      interactionTimeEl.textContent = formatTime(cumulativeInteraction[idx] ?? 0);
    }

    graph.setCurrentIndex(idx);
    graph.setValueAt(idx, row.cumulativeUnique ?? 0);
    graph.render();
  };

  const ro = new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    graph.render();
  });
  ro.observe(canvas);

  video.addEventListener('loadedmetadata', updateForTime);
  video.addEventListener('timeupdate', updateForTime);

  return section;
}

function buildErrorCard(kpi, index, error) {
  const camLabel = `CAM-${String(index + 1).padStart(2, '0')}`;
  const displayTitle = kpi.label || KPI_LABELS[kpi.type] || kpi.type.toUpperCase();

  const section = document.createElement('section');
  section.className = 'kpi-card kpi-card-error';
  section.innerHTML = `
    <div class="kpi-header">
      <div class="kpi-title-wrap">
        <span class="kpi-title-icon" aria-hidden="true">${KPI_ICONS[kpi.type] || ''}</span>
        <h2 class="kpi-title">${displayTitle}</h2>
      </div>
      <span class="kpi-badge kpi-badge-error">ERROR</span>
    </div>
    <div class="kpi-body">
      <div class="kpi-video-container">
        <span class="kpi-video-label">${camLabel}</span>
        <video class="kpi-video" controls muted playsinline autoplay loop></video>
      </div>
      <div class="kpi-right">
        <div class="kpi-error-msg">
          <p>Could not load database.</p>
          <p class="kpi-error-detail">${error?.message || 'Unknown error'}</p>
          <p class="kpi-error-hint">Check that the Database URL is correct and that the S3 bucket has CORS enabled.</p>
        </div>
      </div>
    </div>
  `;
  const video = section.querySelector('.kpi-video');
  video.src = kpi.videoUrl;
  return section;
}

export async function renderDashboard(appEl, config) {
  // 1. Render shell immediately for instant visual feedback
  appEl.innerHTML = buildDashboardShell(config);

  // Start clock
  const clockEl = appEl.querySelector('#ist-clock');
  if (clockEl) {
    clockEl.textContent = formatISTTime();
    setInterval(() => { clockEl.textContent = formatISTTime(); }, 1000);
  }

  // Reconfigure button
  appEl.querySelector('#reconfigure-btn')?.addEventListener('click', () => {
    window.location.hash = '';
  });

  // 2. Fetch all KPI databases in parallel
  const settled = await Promise.allSettled(
    config.kpis.map((kpi) => loadKpiDatabase(kpi.dbUrl, kpi.type))
  );

  // 3. Build and mount KPI cards
  const mainEl = appEl.querySelector('#kpi-main');
  mainEl.innerHTML = ''; // clear loading state

  config.kpis.forEach((kpi, i) => {
    const result = settled[i];
    let card;

    if (result.status === 'fulfilled') {
      const dbResult = result.value;
      if (kpi.type === 'footfall' || kpi.type === 'passerby') {
        card = buildFootfallCard(kpi, i, dbResult);
      } else if (kpi.type === 'zone-entry') {
        card = buildZoneEntryCard(kpi, i, dbResult);
      } else {
        card = buildErrorCard(kpi, i, new Error(`Unknown KPI type: ${kpi.type}`));
      }
    } else {
      card = buildErrorCard(kpi, i, result.reason);
    }

    mainEl.appendChild(card);
  });
}
