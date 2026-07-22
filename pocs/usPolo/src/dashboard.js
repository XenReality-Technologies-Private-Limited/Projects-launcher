import { renderFunnel, updateFunnel }   from './funnel.js';
import { renderSpotlightJourney }        from './journey.js';
import { computeCurrentTotals }          from './analytics.js';

// ── Utilities ──────────────────────────────────────────────────────────────

function pct(rate) {
  return `${Math.round(Math.min(1, rate) * 100)}%`;
}

function rateColor(rate) {
  const r = Math.min(1, rate);
  if (r >= 0.5) return '#10B981';
  if (r >= 0.25) return '#F59E0B';
  return '#EF4444';
}

function rateLabel(rate) {
  const r = Math.min(1, rate);
  if (r >= 0.5) return 'Excellent';
  if (r >= 0.25) return 'Good';
  return 'Can Improve';
}

function healthColor(score) {
  if (score >= 65) return '#10B981';
  if (score >= 35) return '#F59E0B';
  return '#EF4444';
}

function healthLabel(score) {
  if (score >= 65) return 'Excellent';
  if (score >= 35) return 'Good';
  return 'Can Improve';
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  const toRad = (d) => (d * Math.PI) / 180;
  const sx = cx + r * Math.cos(toRad(startDeg));
  const sy = cy + r * Math.sin(toRad(startDeg));
  const ex = cx + r * Math.cos(toRad(endDeg));
  const ey = cy + r * Math.sin(toRad(endDeg));
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`;
}

function buildGaugeSVG(score) {
  const cx = 60, cy = 60, r = 46;
  const startDeg = 135, totalDeg = 270;
  const color = healthColor(score);
  const fillDeg = startDeg + (score / 100) * totalDeg;
  const bgPath   = arcPath(cx, cy, r, startDeg, startDeg + totalDeg);
  const fillPath = arcPath(cx, cy, r, startDeg, fillDeg);
  const circumference = 2 * Math.PI * r;
  return `
    <svg viewBox="0 0 120 124" width="120" height="124">
      <path d="${bgPath}" fill="none" stroke="#E5E7EB" stroke-width="10" stroke-linecap="round"/>
      <path
        class="gauge-arc"
        d="${fillPath}"
        fill="none"
        stroke="${color}"
        stroke-width="10"
        stroke-linecap="round"
        style="stroke-dasharray:${circumference};stroke-dashoffset:${circumference}"
      />
      <text x="60" y="54" text-anchor="middle" font-size="22" font-weight="700" fill="${color}">${score}</text>
      <text x="60" y="68" text-anchor="middle" font-size="10" fill="#6B7280">/ 100</text>
      <text x="60" y="114" text-anchor="middle" font-size="9" fill="${color}" font-weight="600">${healthLabel(score).toUpperCase()}</text>
    </svg>`;
}

function buildRateCard(label, rate) {
  const r = Math.min(1, Math.max(0, rate));
  const p = Math.round(r * 100);
  const color = rateColor(r);
  const lbl = rateLabel(r);
  const arcEnd = 135 + (r * 270);
  const bg   = arcPath(24, 24, 18, 135, 405);
  const fill = arcPath(24, 24, 18, 135, arcEnd);
  return `
    <div class="rate-card">
      <div class="rate-card-inner">
        <svg viewBox="0 0 48 48" width="56" height="56">
          <path d="${bg}"   fill="none" stroke="#E5E7EB" stroke-width="5" stroke-linecap="round"/>
          <path d="${fill}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"
            class="rate-arc" style="--arc-color:${color}"/>
        </svg>
        <div class="rate-info">
          <div class="rate-pct" style="color:${color}">${p}%</div>
          <div class="rate-label">${label}</div>
          <div class="rate-status" style="color:${color}">${lbl}</div>
        </div>
      </div>
    </div>`;
}

function buildDwellBars(dwellByZone) {
  const ORDER = ['trial', 'upstairs', 'billing'];
  const entries = ORDER.map((z) => [z, dwellByZone[z]]).filter(([, v]) => v && v.avg > 0);

  if (entries.length === 0) {
    return `<div class="empty-state"><p>Dwell time data not available.</p>
      <p class="empty-sub">Add zone_events.csv to enable zone dwell analysis.</p></div>`;
  }

  const maxAvg = Math.max(...entries.map(([, v]) => v.avg), 1);
  const ZONE_COLORS = { entrance: '#6B7280', trial: '#8B5CF6', upstairs: '#F59E0B', billing: '#10B981' };

  return entries.map(([zone, info], i) => {
    const barPct = Math.round((info.avg / maxAvg) * 100);
    const color  = ZONE_COLORS[zone] || '#2563EB';
    return `
      <div class="dwell-row" style="--dwell-delay:${i * 100}ms">
        <div class="dwell-zone">${info.label}</div>
        <div class="dwell-bar-wrap">
          <div class="dwell-bar" data-target="${barPct}" style="background:${color};width:0%"></div>
        </div>
        <div class="dwell-time" style="color:${color}">${info.formatted}</div>
      </div>`;
  }).join('');
}

function demoBadge(prefix, val, total) {
  const pctStr = total > 0 ? ` (${Math.round(((val || 0) / total) * 100)}%)` : '';
  return `${prefix}: ${(val || 0).toLocaleString()}${pctStr}`;
}

function buildKpiCard(id, icon, label, value, color, sublabel, manId, womanId, manVal, womanVal) {
  const demoRow = (manId && womanId) ? (() => {
    const m = manVal || 0, f = womanVal || 0, total = m + f;
    return `
    <div class="kpi-demo">
      <span class="kpi-demo-m" id="${manId}">${demoBadge('M', m, total)}</span>
      <span class="kpi-demo-w" id="${womanId}">${demoBadge('F', f, total)}</span>
    </div>`;
  })() : '';
  return `
    <div class="kpi-card" style="--kpi-color:${color}">
      <div class="kpi-icon" style="color:${color}">${icon}</div>
      <div class="kpi-body">
        <div class="kpi-value" id="${id}" style="color:${color}">${value.toLocaleString()}</div>
        <div class="kpi-label">${label}</div>
        ${sublabel ? `<div class="kpi-sub">${sublabel}</div>` : ''}
        ${demoRow}
      </div>
      <div class="kpi-accent" style="background:${color}"></div>
    </div>`;
}

function fmtTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(Math.floor(sec % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

function animateCount(el, target, delay = 0) {
  setTimeout(() => {
    const duration = 1400;
    const start    = performance.now();
    function step(now) {
      const t    = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * ease).toLocaleString();
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, delay);
}

// ── Main render ────────────────────────────────────────────────────────────

export function renderDashboard(app, analytics, rows, assetUrls) {
  const { totals, rates, healthScore, dwellByZone, spotlightJourney } = analytics;

  // Fixed maximum passerby (last row) — used to keep funnel bar widths stable
  const maxPasserby = totals.passerby || 1;

  app.innerHTML = `
    <!-- HEADER -->
    <header class="dash-header">
      <div class="header-xr-block"><div class="header-logo-pill"><img src="https://d108xxen99ni2a.cloudfront.net/XenRealitylogo.webp" alt="XenReality" /></div><div class="header-vdivider"></div></div>
      <div class="header-title">PoC Dashboard</div>
      <div class="header-right">
        <div class="header-datetime">
          <span class="header-date" id="hdr-date"></span>
          <span class="header-time" id="hdr-time"></span>
        </div>
        <div class="header-live-pill"><span class="live-dot"></span>Live</div>
        <img class="header-customer-logo" src="/us-polo-logo.png" alt="US Polo" onerror="this.style.display='none'" />
        <button class="header-signout" title="Sign out" onclick="(function(){try{localStorage.removeItem('pocketbase_auth');}catch(e){}window.location.reload();})()"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>
      </div>
    </header>

    <!-- VIDEO SECTION -->
    <section class="video-section">
      <div class="video-grid">
        <div class="video-wrap">
          <video id="cam1" src="${assetUrls.cam1}" muted playsinline preload="metadata"></video>
          <div class="video-label">CAM 1 — Entrance</div>
        </div>
        <div class="video-wrap">
          <video id="cam2" src="${assetUrls.cam2}" muted playsinline preload="metadata"></video>
          <div class="video-label">CAM 2 — Stairs to 1st Floor</div>
        </div>
        <div class="video-wrap">
          <video id="cam5" src="${assetUrls.cam5}" muted playsinline preload="metadata"></video>
          <div class="video-label">CAM 5 — Trial &amp; Billing</div>
        </div>
      </div>
      <div class="video-controls">
        <button class="vc-btn" id="btn-play">&#9654; Play All</button>
        <button class="vc-btn" id="btn-pause">&#9646;&#9646; Pause</button>
        <button class="vc-btn" id="btn-reset">&#9198; Reset</button>
        <span class="vc-time" id="time-display">00:00 / 00:00</span>
        <input type="range" class="vc-seek" id="seek-bar" min="0" max="100" value="0" step="0.05"/>
      </div>
    </section>

    <!-- HERO KPIs -->
    <section class="hero-section">
      <div class="hero-grid">
        ${buildKpiCard('kpi-passerby', '⟳', 'Passerby',      totals.passerby,   '#6B7280', 'Footfall outside')}
        ${buildKpiCard('kpi-store',   '↗', 'Store Visitors', totals.storeEntry, '#2563EB', 'Entered store',      'kpi-store-m',    'kpi-store-w',    totals.storeEntryMan,   totals.storeEntryWoman)}
        ${buildKpiCard('kpi-trial',   '◫', 'Trial Zone',     totals.trialRoom,  '#8B5CF6', 'Fitting room visits','kpi-trial-m',    'kpi-trial-w',    totals.trialEntryMan,   totals.trialEntryWoman)}
        ${buildKpiCard('kpi-billing', '✓', 'Billing Done',   totals.billing,    '#10B981', 'Completed purchase', 'kpi-billing-m',  'kpi-billing-w',  totals.billingMan,      totals.billingWoman)}
        ${buildKpiCard('kpi-upstairs','⬆', '1st Floor',      totals.upstairs,   '#F59E0B', 'Went upstairs',      'kpi-upstairs-m', 'kpi-upstairs-w', totals.upstairsMan,     totals.upstairsWoman)}
      </div>
    </section>

    <!-- FUNNEL + INSIGHTS -->
    <section class="mid-section">
      <div class="funnel-panel card">
        <h2 class="card-title">Customer Journey Funnel</h2>
        <p class="card-sub">Live conversion from passerby to purchase</p>
        <div id="funnel-mount"></div>
      </div>
      <div class="insights-panel">
        <div class="rate-cards-grid">
          ${buildRateCard('Passerby → Store Entry',    rates.captureRate)}
          ${buildRateCard('Store Entry → Trial Zone', rates.trialRate)}
          ${buildRateCard('Trial Zone → Purchase',    rates.purchaseRate)}
          ${buildRateCard('Store Entry → 1st Floor',  rates.floorExplorer)}
        </div>
        <div class="health-card card">
          <h3 class="card-title">Store Performance</h3>
          <div class="health-gauge-wrap">
            <div id="gauge-mount">${buildGaugeSVG(healthScore)}</div>
            <div class="health-breakdown">
              <div class="health-row"><span>Passerby → Store Entry</span>
                <span id="hb-capture" style="color:${rateColor(rates.captureRate)}">${pct(rates.captureRate)}</span></div>
              <div class="health-row"><span>Store Entry → Trial Zone</span>
                <span id="hb-trial" style="color:${rateColor(rates.trialRate)}">${pct(rates.trialRate)}</span></div>
              <div class="health-row"><span>Trial Zone → Purchase</span>
                <span id="hb-purchase" style="color:${rateColor(rates.purchaseRate)}">${pct(rates.purchaseRate)}</span></div>
              <div class="health-row"><span>Store Entry → Purchase</span>
                <span id="hb-overall" style="color:${rateColor(rates.overallConv)}">${pct(rates.overallConv)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- DWELL + JOURNEY -->
    <section class="analytics-section">
      <div class="dwell-panel card">
        <h2 class="card-title">Zone Dwell Times</h2>
        <p class="card-sub">Average time customers spent in each area</p>
        <div id="dwell-mount" class="dwell-chart"></div>
      </div>
      <div class="journey-panel card">
        <h2 class="card-title">Customer Journey Spotlight</h2>
        <p class="card-sub">AI-tracked path of an individual customer through the store</p>
        <div id="journey-mount"></div>
      </div>
    </section>

    <footer class="footer">
      Powered by <strong>XenReality</strong> Vision AI &nbsp;·&nbsp; Real-time People Analytics
    </footer>
  `;

  // ── Clock ────────────────────────────────────────────────────────────────
  const hdrDate = app.querySelector('#hdr-date');
  const hdrTime = app.querySelector('#hdr-time');
  function tickClock() {
    const now = new Date();
    const tz = { timeZone: 'Asia/Dubai' };
    if (hdrDate) hdrDate.textContent = now.toLocaleDateString('en-GB', { ...tz, day: '2-digit', month: 'short', year: 'numeric' });
    if (hdrTime) hdrTime.textContent = now.toLocaleTimeString('en-GB', { ...tz, hour: '2-digit', minute: '2-digit' });
  }
  tickClock();
  setInterval(tickClock, 1000);

  // ── KPI initial count-up animations ─────────────────────────────────────
  const kpiIds = [
    ['kpi-passerby', totals.passerby],
    ['kpi-store',    totals.storeEntry],
    ['kpi-trial',    totals.trialRoom],
    ['kpi-billing',  totals.billing],
    ['kpi-upstairs', totals.upstairs],
  ];
  kpiIds.forEach(([id, val], i) => {
    const el = document.getElementById(id);
    if (el) animateCount(el, val, i * 120);
  });

  // ── Funnel (initial static render) ──────────────────────────────────────
  const funnelMount = document.getElementById('funnel-mount');
  renderFunnel(funnelMount, { totals, rates });

  // ── Gauge arc animation ──────────────────────────────────────────────────
  requestAnimationFrame(() => {
    app.querySelectorAll('.gauge-arc, .rate-arc').forEach((arc) => {
      arc.style.strokeDashoffset = '0';
    });
  });

  // ── Health breakdown IDs ─────────────────────────────────────────────────
  const hbEls = {
    capture:  document.getElementById('hb-capture'),
    trial:    document.getElementById('hb-trial'),
    purchase: document.getElementById('hb-purchase'),
    overall:  document.getElementById('hb-overall'),
  };

  // ── Dwell bars ───────────────────────────────────────────────────────────
  const dwellMount = document.getElementById('dwell-mount');
  dwellMount.innerHTML = buildDwellBars(dwellByZone);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      dwellMount.querySelectorAll('.dwell-bar').forEach((bar, i) => {
        setTimeout(() => { bar.style.width = `${bar.dataset.target}%`; }, i * 100 + 200);
      });
    });
  });

  // ── Journey chart ────────────────────────────────────────────────────────
  renderSpotlightJourney(document.getElementById('journey-mount'), spotlightJourney, assetUrls);

  // ── Video setup & sync loop ───────────────────────────────────────────────
  const cam1El = document.getElementById('cam1');
  const cam2El = document.getElementById('cam2');
  const cam5El = document.getElementById('cam5');
  const allVideos = [cam1El, cam2El, cam5El];

  const btnPlay  = document.getElementById('btn-play');
  const btnPause = document.getElementById('btn-pause');
  const btnReset = document.getElementById('btn-reset');
  const seekBar  = document.getElementById('seek-bar');
  const timeDisplay = document.getElementById('time-display');

  let duration = 0;
  let isSeeking = false;
  const SYNC_THRESHOLD = 0.3; // seconds — resync if slave drifts more than this

  cam1El.addEventListener('loadedmetadata', () => {
    duration = cam1El.duration || 0;
    timeDisplay.textContent = `00:00 / ${fmtTime(duration)}`;
  });

  btnPlay.onclick  = () => allVideos.forEach((v) => v.play());
  btnPause.onclick = () => allVideos.forEach((v) => v.pause());
  btnReset.onclick = () => {
    allVideos.forEach((v) => { v.pause(); v.currentTime = 0; });
    seekBar.value = 0;
    timeDisplay.textContent = `00:00 / ${fmtTime(duration)}`;
    syncToFrame(0);
  };

  // Seek bar — user drags
  seekBar.addEventListener('mousedown', () => { isSeeking = true; });
  seekBar.addEventListener('input', () => {
    if (duration <= 0) return;
    const t = (seekBar.value / 100) * duration;
    allVideos.forEach((v) => { v.currentTime = t; });
  });
  seekBar.addEventListener('mouseup', () => { isSeeking = false; });

  // ── Sync all live UI to a given video timestamp ───────────────────────────
  function syncToFrame(currentTime) {
    const idx = Math.min(Math.floor(currentTime), rows.length - 1);
    const { totals: ct, rates: cr } = computeCurrentTotals(rows, idx);

    // KPI numbers
    const kpiValues = [ct.passerby, ct.storeEntry, ct.trialRoom, ct.billing, ct.upstairs];
    kpiIds.forEach(([id], i) => {
      const el = document.getElementById(id);
      if (el) el.textContent = kpiValues[i].toLocaleString();
    });

    // Demographics
    [
      { mId: 'kpi-store-m',    fId: 'kpi-store-w',    m: ct.storeEntryMan,  f: ct.storeEntryWoman },
      { mId: 'kpi-trial-m',    fId: 'kpi-trial-w',    m: ct.trialEntryMan,  f: ct.trialEntryWoman },
      { mId: 'kpi-billing-m',  fId: 'kpi-billing-w',  m: ct.billingMan,     f: ct.billingWoman },
      { mId: 'kpi-upstairs-m', fId: 'kpi-upstairs-w', m: ct.upstairsMan,    f: ct.upstairsWoman },
    ].forEach(({ mId, fId, m, f }) => {
      const total = (m || 0) + (f || 0);
      const mEl = document.getElementById(mId);
      const fEl = document.getElementById(fId);
      if (mEl) mEl.textContent = demoBadge('M', m, total);
      if (fEl) fEl.textContent = demoBadge('F', f, total);
    });

    // Funnel + health breakdown
    updateFunnel(funnelMount, ct, cr, maxPasserby);
    if (hbEls.capture)  { hbEls.capture.textContent  = pct(cr.captureRate);   hbEls.capture.style.color  = rateColor(cr.captureRate); }
    if (hbEls.trial)    { hbEls.trial.textContent    = pct(cr.trialRate);     hbEls.trial.style.color    = rateColor(cr.trialRate); }
    if (hbEls.purchase) { hbEls.purchase.textContent = pct(cr.purchaseRate);  hbEls.purchase.style.color = rateColor(cr.purchaseRate); }
    if (hbEls.overall)  { hbEls.overall.textContent  = pct(cr.overallConv);   hbEls.overall.style.color  = rateColor(cr.overallConv); }
  }

  // ── Master sync: cam1 drives all live updates ────────────────────────────
  cam1El.addEventListener('timeupdate', () => {
    const currentTime = cam1El.currentTime || 0;

    // Resync slave cameras if they drift
    [cam2El, cam5El].forEach((v) => {
      if (!v.paused && Math.abs(v.currentTime - currentTime) > SYNC_THRESHOLD) {
        v.currentTime = currentTime;
      }
    });

    // Time display + seek bar
    if (!isSeeking && duration > 0) {
      seekBar.value = (currentTime / duration) * 100;
    }
    timeDisplay.textContent = `${fmtTime(currentTime)} / ${fmtTime(duration)}`;

    syncToFrame(currentTime);
  });
}
