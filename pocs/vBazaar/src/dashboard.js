import { MultiSeriesGraph, TimeSeriesGraph } from './graph.js';
import { findRow } from './db.js';

const CF       = 'https://d2uimaqek2eby3.cloudfront.net/V%20Bazaar';
const LOGO     = `${CF}/V-Bazaar-logo.png`;
const LIVE_URL = 'https://xentrack.xenreality.com/vBazaarLive/';

function fmtMmSs(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function queueColor(count) {
  if (count < 2)  return { label: 'Queue < 2',   color: '#10B981' };
  if (count <= 3) return { label: 'Queue 2–3',   color: '#F59E0B' };
  return                  { label: 'Queue > 3',  color: '#EF4444' };
}

// Build per-second value arrays from sparse timestamp rows
function buildFootfallSeries(rows) {
  if (!rows.length) return { male: [], female: [], child: [] };
  const maxT = rows[rows.length - 1].t;
  const male = [], female = [], child = [];
  let ri = 0;
  for (let s = 0; s <= maxT; s++) {
    while (ri + 1 < rows.length && rows[ri + 1].t <= s) ri++;
    const [m, f, c] = rows[ri].in;
    male.push(m); female.push(f); child.push(c);
  }
  return { male, female, child };
}

function buildBillingSeries(rows) {
  if (!rows.length) return { customerCount: [] };
  const maxT = rows[rows.length - 1].t;
  const customerCount = [];
  let ri = 0;
  for (let s = 0; s <= maxT; s++) {
    while (ri + 1 < rows.length && rows[ri + 1].t <= s) ri++;
    customerCount.push(rows[ri].customerCount);
  }
  return { customerCount };
}

export function renderDashboard(app, data, videos) {
  const ftSeries   = buildFootfallSeries(data.footfall);
  const billSeries = buildBillingSeries(data.billing);

  app.innerHTML = `
    <header class="dash-header">
      <div class="header-xr-block">
        <img src="https://d108xxen99ni2a.cloudfront.net/XenRealitylogo.webp" alt="XenReality" />
      </div>
      <div class="header-title">V Bazaar PoC Dashboard</div>
      <div class="header-right">
        <div class="view-toggle" id="view-toggle">
          <button class="view-toggle-btn active" id="btn-poc">PoC</button>
          <button class="view-toggle-btn" id="btn-live">Live</button>
        </div>
        <img class="header-customer-logo" src="${LOGO}" alt="V Bazaar" />
      </div>
    </header>

    <iframe id="live-frame" src="" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:200;"></iframe>

    <main class="dashboard-main" id="poc-body">

      <section class="kpi-card" id="kpi-footfall" data-kpi="footfall">
        <div class="kpi-header">
          <div class="kpi-title-wrap">
            <span class="kpi-title-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </span>
            <h2 class="kpi-title">FOOTFALL</h2>
          </div>
          <span class="kpi-badge">ACTIVE</span>
        </div>
        <div class="kpi-body">
          <div class="kpi-video-container">
            <span class="kpi-video-label">CAM-01</span>
            <video class="kpi-video" src="${videos.footfall}" controls muted playsinline autoplay loop></video>
          </div>
          <div class="kpi-right">
            <div class="kpi-metric-label">FOOTFALL</div>
            <div class="kpi-metric-value" id="ft-total">0</div>
            <canvas class="kpi-graph" width="600" height="160"></canvas>
            <div class="kpi-legend">Blue: Male &nbsp;·&nbsp; Pink: Female &nbsp;·&nbsp; Yellow: Child</div>
          </div>
        </div>
      </section>

      <section class="kpi-card" id="kpi-billing" data-kpi="billing">
        <div class="kpi-header">
          <div class="kpi-title-wrap">
            <span class="kpi-title-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            </span>
            <h2 class="kpi-title">BILLING COUNTER</h2>
          </div>
          <span class="kpi-badge" id="billing-queue-badge" style="background:rgba(16,185,129,.12);color:#047857;border-color:rgba(16,185,129,.35)">Queue &lt; 2</span>
        </div>
        <div class="kpi-body">
          <div class="kpi-video-container">
            <span class="kpi-video-label">CAM-02</span>
            <video class="kpi-video" src="${videos.billing}" controls muted playsinline autoplay loop></video>
          </div>
          <div class="kpi-right">
            <div class="kpi-metric-label">CUSTOMERS AT REGISTER</div>
            <div class="kpi-metric-value" id="bill-cust">0</div>
            <canvas class="kpi-graph" width="600" height="160"></canvas>
            <div class="kpi-legend">Customers at billing counter over time</div>
            <div class="kpi-metric-label">EMPLOYEE TIME</div>
            <div class="kpi-metric-value" id="bill-emp-time" style="font-size:1.6rem">00:00</div>
            <div class="kpi-metric-label">INTERACTION TIME</div>
            <div class="kpi-metric-value" id="bill-int-time" style="font-size:1.6rem">00:00</div>
          </div>
        </div>
      </section>

    </main>
  `;

  // ── Footfall graph ────────────────────────────────────────────────────────
  const ftSection = document.getElementById('kpi-footfall');
  const ftVideo   = ftSection.querySelector('.kpi-video');
  const ftCanvas  = ftSection.querySelector('.kpi-graph');
  const ftTotalEl = document.getElementById('ft-total');

  const ftGraph = new MultiSeriesGraph(ftCanvas, {
    series: [
      { values: ftSeries.male,   color: '#2563eb', label: 'Male' },
      { values: ftSeries.female, color: '#ec4899', label: 'Female' },
      { values: ftSeries.child,  color: '#eab308', label: 'Child' },
    ],
    yMax: 50,
    playheadColor: '#6b7280',
    showLiveCount: true,
  });

  const ftResizer = new ResizeObserver(() => {
    const r = ftCanvas.getBoundingClientRect();
    ftCanvas.width  = r.width  * window.devicePixelRatio;
    ftCanvas.height = r.height * window.devicePixelRatio;
    ftGraph.render();
  });
  ftResizer.observe(ftCanvas);

  ftVideo.addEventListener('timeupdate', () => {
    const idx = Math.min(Math.floor(ftVideo.currentTime || 0), Math.max(0, ftSeries.male.length - 1));
    const row = findRow(data.footfall, ftVideo.currentTime || 0);
    const [m, f, c] = row ? row.in : [0, 0, 0];
    ftTotalEl.textContent = String(m + f + c);
    ftGraph.setCurrentIndex(idx);
    ftGraph.render();
  });

  // ── Billing graph ─────────────────────────────────────────────────────────
  const billSection  = document.getElementById('kpi-billing');
  const billVideo    = billSection.querySelector('.kpi-video');
  const billCanvas   = billSection.querySelector('.kpi-graph');
  const billCustEl   = document.getElementById('bill-cust');
  const billEmpEl    = document.getElementById('bill-emp-time');
  const billIntEl    = document.getElementById('bill-int-time');
  const billQueueBadge = document.getElementById('billing-queue-badge');

  const maxCust = billSeries.customerCount.length
    ? Math.max(...billSeries.customerCount, 5)
    : 5;

  const billGraph = new TimeSeriesGraph(billCanvas, {
    lineColor: '#8B1010',
    playheadColor: '#6b7280',
    yMax: Math.ceil(maxCust * 1.2),
    showLiveCount: true,
  });
  billGraph.setValues(billSeries.customerCount);

  const billResizer = new ResizeObserver(() => {
    const r = billCanvas.getBoundingClientRect();
    billCanvas.width  = r.width  * window.devicePixelRatio;
    billCanvas.height = r.height * window.devicePixelRatio;
    billGraph.render();
  });
  billResizer.observe(billCanvas);

  billVideo.addEventListener('timeupdate', () => {
    const idx = Math.min(Math.floor(billVideo.currentTime || 0), Math.max(0, billSeries.customerCount.length - 1));
    const row = findRow(data.billing, billVideo.currentTime || 0);
    if (row) {
      billCustEl.textContent = String(row.customerCount);
      billEmpEl.textContent  = fmtMmSs(row.employeeTimeSecs);
      billIntEl.textContent  = fmtMmSs(row.interactionTimeSecs);
      const q = queueColor(row.customerCount);
      billQueueBadge.textContent = q.label;
      billQueueBadge.style.background   = q.color + '22';
      billQueueBadge.style.color        = q.color;
      billQueueBadge.style.borderColor  = q.color + '88';
    }
    billGraph.setCurrentIndex(idx);
    billGraph.render();
  });

  // ── PoC / Live toggle ─────────────────────────────────────────────────────
  const pocBody    = document.getElementById('poc-body');
  const liveFrame  = document.getElementById('live-frame');
  const btnPoc     = document.getElementById('btn-poc');
  const btnLive    = document.getElementById('btn-live');
  const dashHeader = document.querySelector('.dash-header');
  const headerTitle   = dashHeader.querySelector('.header-title');
  const headerXrBlock = dashHeader.querySelector('.header-xr-block');

  btnLive.addEventListener('click', () => {
    pocBody.style.display = 'none';
    if (!liveFrame.src || liveFrame.src === location.href) liveFrame.src = LIVE_URL;
    liveFrame.style.display          = 'block';
    dashHeader.style.background      = 'transparent';
    dashHeader.style.boxShadow       = 'none';
    dashHeader.style.pointerEvents   = 'none';
    dashHeader.querySelector('.header-right').style.pointerEvents = 'auto';
    headerTitle.style.visibility     = 'hidden';
    headerXrBlock.style.visibility   = 'hidden';
    btnLive.classList.add('active');
    btnPoc.classList.remove('active');
  });

  btnPoc.addEventListener('click', () => {
    liveFrame.style.display          = 'none';
    pocBody.style.display            = '';
    dashHeader.style.background      = '';
    dashHeader.style.boxShadow       = '';
    dashHeader.style.pointerEvents   = '';
    dashHeader.querySelector('.header-right').style.pointerEvents = '';
    headerTitle.style.visibility     = '';
    headerXrBlock.style.visibility   = '';
    btnPoc.classList.add('active');
    btnLive.classList.remove('active');
  });
}
