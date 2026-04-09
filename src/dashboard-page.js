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
  const total = Math.round(seconds);
  const mm = Math.floor(total / 60).toString().padStart(2, '0');
  const ss = (total % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

const KPI_ICONS = {
  footfall: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  passerby: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  'zone-entry': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`,
  billing: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 8h2m4 0h2M7 11h2m4 0h2"/></svg>`,
};

const KPI_LABELS = {
  footfall:    'FOOTFALL',
  passerby:   'PASSERBY',
  'zone-entry': 'ZONE ENTRY',
  billing:     'BILLING COUNTER',
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
        <div class="kpi-metric-label">IN COUNT</div>
        <div class="bh-ff-row">
          <div class="kpi-metric-value">--</div>
          <canvas class="kpi-graph kpi-graph-in" width="600" height="120"></canvas>
        </div>
        <div class="kpi-legend"><div>Blue: Male &middot; Pink: Female &middot; Yellow: Child</div></div>
        <div class="kpi-metric-label">OUT COUNT</div>
        <div class="bh-ff-row">
          <div class="kpi-metric-value bh-out-total">--</div>
          <canvas class="kpi-graph kpi-graph-out" width="600" height="120"></canvas>
        </div>
        <div class="kpi-legend"><div>Blue: Male &middot; Pink: Female &middot; Yellow: Child</div></div>
        <div class="kpi-metric-label">AVG DWELL TIME</div>
        <div class="kpi-metric-value bh-dwell-time-value">--:--</div>
        <div style="font-size:0.65em;color:#9ca3af;letter-spacing:0.05em;margin-top:-4px;">Minutes : Seconds</div>
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

  const { rows, inMaleSeries, inFemaleSeries, inChildSeries, outMaleSeries, outFemaleSeries, outChildSeries } = dbResult.data;
  const canvasIn = section.querySelector('.kpi-graph-in');
  const canvasOut = section.querySelector('.kpi-graph-out');
  const inTotalEl = section.querySelector('.kpi-metric-value');
  const outTotalEl = section.querySelector('.bh-out-total');
  const dwellTimeEl = section.querySelector('.bh-dwell-time-value');

  const inMax = Math.max(0, ...inMaleSeries, ...inFemaleSeries, ...inChildSeries);
  const outMax = Math.max(0, ...outMaleSeries, ...outFemaleSeries, ...outChildSeries);

  const graphIn = new MultiSeriesGraph(canvasIn, {
    series: [
      { values: inMaleSeries,   color: FOOTFALL_COLORS.male,   label: 'Male' },
      { values: inFemaleSeries, color: FOOTFALL_COLORS.female, label: 'Female' },
      { values: inChildSeries,  color: FOOTFALL_COLORS.child,  label: 'Child' },
    ],
    yMax: Math.ceil(inMax * 1.5) || 5,
    playheadColor: '#6b7280',
    showLiveCount: true,
  });

  const graphOut = new MultiSeriesGraph(canvasOut, {
    series: [
      { values: outMaleSeries,   color: FOOTFALL_COLORS.male,   label: 'Male' },
      { values: outFemaleSeries, color: FOOTFALL_COLORS.female, label: 'Female' },
      { values: outChildSeries,  color: FOOTFALL_COLORS.child,  label: 'Child' },
    ],
    yMax: Math.ceil(outMax * 1.5) || 5,
    playheadColor: '#6b7280',
    showLiveCount: true,
  });

  const updateForTime = () => {
    if (!rows.length) {
      inTotalEl.textContent = '0';
      outTotalEl.textContent = '0';
      dwellTimeEl.textContent = '00:00';
      graphIn.render();
      graphOut.render();
      return;
    }
    const idx = Math.min(Math.floor(video.currentTime || 0), rows.length - 1);
    const row = rows[idx];
    const inCount = row.in_count || [0, 0, 0];
    const outCount = row.out_count || [0, 0, 0];
    inTotalEl.textContent = String(inCount[0] + inCount[1] + inCount[2]);
    outTotalEl.textContent = String(outCount[0] + outCount[1] + outCount[2]);
    dwellTimeEl.textContent = formatTime(row.avg_dwell_time || 0);
    graphIn.setCurrentIndex(idx);
    graphIn.render();
    graphOut.setCurrentIndex(idx);
    graphOut.render();
  };

  const roIn = new ResizeObserver(() => {
    const rect = canvasIn.getBoundingClientRect();
    canvasIn.width = rect.width * window.devicePixelRatio;
    canvasIn.height = rect.height * window.devicePixelRatio;
    graphIn.render();
  });
  roIn.observe(canvasIn);

  const roOut = new ResizeObserver(() => {
    const rect = canvasOut.getBoundingClientRect();
    canvasOut.width = rect.width * window.devicePixelRatio;
    canvasOut.height = rect.height * window.devicePixelRatio;
    graphOut.render();
  });
  roOut.observe(canvasOut);

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

function buildBillingCard(kpi, index, dbResult) {
  const camLabel = `CAM-${String(index + 1).padStart(2, '0')}`;
  const displayTitle = kpi.label || KPI_LABELS[kpi.type] || kpi.type.toUpperCase();

  const section = document.createElement('section');
  section.className = 'kpi-card kpi-billing';
  section.dataset.kpiIndex = index;
  section.innerHTML = `
    <div class="kpi-header">
      <div class="kpi-title-wrap">
        <span class="kpi-title-icon" aria-hidden="true">${KPI_ICONS.billing}</span>
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
        <div class="kpi-metric-label">CUSTOMER COUNT</div>
        <div class="kpi-metric-value">--</div>
        <div class="kpi-metric-label">EMPLOYEE TIME</div>
        <div class="kpi-metric-value bh-employee-time-value">--:--</div>
        <div style="font-size:0.65em;color:#9ca3af;letter-spacing:0.05em;margin-top:-4px;">Minutes : Seconds</div>
        <div class="kpi-metric-label">INTERACTION TIME</div>
        <div class="kpi-metric-value bh-interaction-time-value">--:--</div>
        <div style="font-size:0.65em;color:#9ca3af;letter-spacing:0.05em;margin-top:-4px;">Minutes : Seconds</div>
        <canvas class="kpi-graph" width="600" height="160"></canvas>
        <div class="kpi-legend"><div>Customer count over time</div></div>
      </div>
    </div>
  `;

  const video = section.querySelector('.kpi-video');
  video.src = kpi.videoUrl;

  if (!dbResult) {
    section.querySelector('.kpi-metric-value').textContent = 'ERROR';
    return section;
  }

  const { rows, customerSeries } = dbResult.data;
  const canvas = section.querySelector('.kpi-graph');
  const metricValue = section.querySelector('.kpi-metric-value');
  const employeeBadge = section.querySelector('.kpi-employee-badge');
  const employeeTimeEl = section.querySelector('.bh-employee-time-value');
  const interactionTimeEl = section.querySelector('.bh-interaction-time-value');

  const maxCustomer = Math.max(0, ...customerSeries);
  const graph = new TimeSeriesGraph(canvas, {
    yMax: Math.ceil(maxCustomer * 1.2) || 5,
    lineColor: '#f59e0b',
    playheadColor: '#6b7280',
    showLiveCount: true,
  });
  graph.setValues(customerSeries);

  const updateForTime = () => {
    if (!rows.length) {
      metricValue.textContent = '0';
      employeeBadge.textContent = 'Employee: --';
      employeeBadge.classList.remove('employee-present', 'employee-absent');
      employeeTimeEl.textContent = '00:00';
      interactionTimeEl.textContent = '00:00';
      graph.render();
      return;
    }
    const idx = Math.min(Math.floor(video.currentTime || 0), rows.length - 1);
    const row = rows[idx];

    metricValue.textContent = String(row.customer_count ?? 0);

    const present = row.employee_present === true;
    employeeBadge.textContent = present ? 'Employee: Present' : 'Employee: Absent';
    employeeBadge.classList.toggle('employee-present', present);
    employeeBadge.classList.toggle('employee-absent', !present);

    employeeTimeEl.textContent = formatTime(row.employee_time_seconds || 0);
    interactionTimeEl.textContent = formatTime(row.interaction_time_seconds || 0);

    graph.setCurrentIndex(idx);
    graph.setValueAt(idx, row.customer_count ?? 0);
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
      } else if (kpi.type === 'billing') {
        card = buildBillingCard(kpi, i, dbResult);
      } else {
        card = buildErrorCard(kpi, i, new Error(`Unknown KPI type: ${kpi.type}`));
      }
    } else {
      card = buildErrorCard(kpi, i, result.reason);
    }

    mainEl.appendChild(card);
  });
}
