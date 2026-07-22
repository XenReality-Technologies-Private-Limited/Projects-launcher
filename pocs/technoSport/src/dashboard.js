import { computeFrame } from './analytics.js';
import { renderFunnel, updateFunnel } from './funnel.js';

const SYNC_THRESHOLD = 0.3;

// ── Utilities ─────────────────────────────────────────────────────────────────

function fmtTime(sec) {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function pct(rate) { return `${Math.round(Math.min(1, Math.max(0, rate)) * 100)}%`; }

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

// ── SVG Helpers ───────────────────────────────────────────────────────────────

function arcPath(cx, cy, r, startDeg, endDeg) {
  const rad = (d) => (d * Math.PI) / 180;
  const sx = cx + r * Math.cos(rad(startDeg));
  const sy = cy + r * Math.sin(rad(startDeg));
  const ex = cx + r * Math.cos(rad(endDeg));
  const ey = cy + r * Math.sin(rad(endDeg));
  const lg = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${sx} ${sy} A ${r} ${r} 0 ${lg} 1 ${ex} ${ey}`;
}

function buildGaugeSVG(score, id) {
  const cx = 60, cy = 60, r = 46;
  const color    = healthColor(score);
  const fullPath = arcPath(cx, cy, r, 135, 405);
  const circ     = 2 * Math.PI * r;
  const offset   = score <= 0 ? circ : circ - (score / 100) * (270 / 360) * circ;
  return `
    <svg viewBox="0 0 120 124" width="120" height="124">
      <path d="${fullPath}" fill="none" stroke="#E5E7EB" stroke-width="10" stroke-linecap="round"/>
      <path id="${id}-arc" class="gauge-arc"
        d="${fullPath}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"
        style="stroke-dasharray:${circ};stroke-dashoffset:${circ}"/>
      <text x="60" y="54" text-anchor="middle" font-size="21" font-weight="800" fill="${color}" id="${id}-score">${score}</text>
      <text x="60" y="68" text-anchor="middle" font-size="10" fill="#94a3b8">/ 100</text>
      <text x="60" y="112" text-anchor="middle" font-size="9" fill="${color}" font-weight="700" id="${id}-label">${healthLabel(score).toUpperCase()}</text>
    </svg>`;
}

function buildRateCard(id, label, rate) {
  const r = Math.min(1, Math.max(0, rate));
  const p = Math.round(r * 100);
  const color = rateColor(r);
  const arcEnd = 135 + (r * 270);
  const bg   = arcPath(24, 24, 18, 135, 405);
  const fill = arcPath(24, 24, 18, 135, arcEnd);
  return `
    <div class="rate-card">
      <div class="rate-card-inner">
        <svg viewBox="0 0 48 48" width="52" height="52" flex-shrink="0">
          <path d="${bg}"   fill="none" stroke="#E5E7EB" stroke-width="5" stroke-linecap="round"/>
          <path id="${id}-arc" d="${fill}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" class="rate-arc"/>
        </svg>
        <div class="rate-info">
          <div class="rate-pct" id="${id}-pct" style="color:${color}">${p}%</div>
          <div class="rate-label">${label}</div>
          <div class="rate-status" id="${id}-status" style="color:${color}">${rateLabel(r)}</div>
        </div>
      </div>
    </div>`;
}

// ── KPI Card Builder ──────────────────────────────────────────────────────────

function buildKpiCard({ id, label, sublabel, color, extraHtml = '' }) {
  return `
    <div class="kpi-card fade-in" style="--kpi-color:${color}">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value" id="${id}">0</div>
      ${sublabel ? `<div class="kpi-sub">${sublabel}</div>` : ''}
      ${extraHtml}
    </div>`;
}

function demoBadges(mId, fId, cId) {
  return `
    <div class="kpi-demo">
      <span class="kpi-badge" id="${mId}"><span class="badge-dot" style="background:#3B82F6"></span>M: 0</span>
      <span class="kpi-badge" id="${fId}"><span class="badge-dot" style="background:#EC4899"></span>F: 0</span>
      <span class="kpi-badge" id="${cId}"><span class="badge-dot" style="background:#F59E0B"></span>C: 0</span>
    </div>`;
}


// ── Dwell Time Section Builder ────────────────────────────────────────────────

function buildDwellSection(frame) {
  const maxDwellMin = Math.max(frame.gfDwellMin, frame.ffDwellMin, (frame.billingDwellSec / 60), 1);

  const zones = [
    { name: 'Ground Floor',   color: '#00AEEF', val: frame.gfDwellMin,            fmt: frame.gfDwellFmt,      id: 'dwell-gf'  },
    { name: 'First Floor',    color: '#F58220', val: frame.ffDwellMin,             fmt: frame.ffDwellFmt,      id: 'dwell-ff'  },
    { name: 'Billing Counter',color: '#8B5CF6', val: frame.billingDwellSec / 60,   fmt: frame.billingDwellFmt, id: 'dwell-bill' },
  ];

  return zones.map(z => `
    <div class="dwell-row-item">
      <div class="dwell-label-row">
        <span class="dwell-zone-name">
          <span class="dwell-zone-dot" style="background:${z.color}"></span>
          ${z.name}
        </span>
        <span class="dwell-value" id="${z.id}-val">${z.fmt || '0s'}</span>
      </div>
      <div class="dwell-track">
        <div class="dwell-bar" id="${z.id}-bar"
          style="background:${z.color}; width:${maxDwellMin > 0 ? Math.round((z.val / maxDwellMin) * 100) : 0}%">
        </div>
      </div>
    </div>`).join('');
}

// ── Main Render ───────────────────────────────────────────────────────────────

export function renderDashboard(app, data, urls) {
  // Initial frame for layout (fraction 0 = start)
  const frame0 = computeFrame(0, data, 0);

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
        <img class="header-customer-logo" src="${urls.logo}" alt="TechnoSport" onerror="this.style.display='none'" />
        <button class="header-signout" title="Sign out" onclick="(function(){try{localStorage.removeItem('pocketbase_auth');}catch(e){}window.location.reload();})()"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>
      </div>
    </header>

    <!-- BODY -->
    <div class="dash-body">

      <!-- VIDEOS -->
      <div class="video-section">
        <div class="video-grid">
          <div class="video-tile">
            <video id="vid-passerby" preload="metadata" playsinline style="object-fit:cover"></video>
            <div class="video-tile-label">Passerby</div>
          </div>
          <div class="video-tile">
            <video id="vid-gf" preload="metadata" playsinline></video>
            <div class="video-tile-label">Footfall – Ground Floor</div>
          </div>
          <div class="video-tile">
            <video id="vid-greet" preload="metadata" playsinline></video>
            <div class="video-tile-label">Greetings</div>
          </div>
          <div class="video-tile">
            <video id="vid-ff" preload="metadata" playsinline></video>
            <div class="video-tile-label">Footfall – First Floor</div>
          </div>
          <div class="video-tile">
            <video id="vid-billing" preload="metadata" playsinline></video>
            <div class="video-tile-label">Billing</div>
          </div>
          <div class="video-tile">
            <video id="vid-heatmap" preload="metadata" playsinline></video>
            <div class="video-tile-label">Heat Map</div>
          </div>
        </div>

        <div class="video-controls">
          <button class="ctrl-btn ctrl-btn-play" id="btn-play">&#9654; Play All</button>
          <button class="ctrl-btn ctrl-btn-pause" id="btn-pause">&#9646;&#9646; Pause</button>
          <button class="ctrl-btn ctrl-btn-reset" id="btn-reset">&#8635; Reset</button>
          <div class="video-seek-wrap">
            <input type="range" class="seek-bar" id="seek-bar" min="0" max="100" value="0" step="0.1" />
            <span class="time-display" id="time-display">0:00 / 0:00</span>
          </div>
        </div>
      </div>

      <!-- KPI CARDS -->
      <div class="kpi-section">
        <div class="section-label">Key Performance Indicators</div>
        <div class="kpi-grid">

          ${buildKpiCard({
            id: 'kpi-pb', label: 'Passerby', sublabel: 'Outside Store',
            color: '#2E3192',
            extraHtml: demoBadges('kpi-pb-m', 'kpi-pb-f', 'kpi-pb-c'),
          })}

          ${buildKpiCard({
            id: 'kpi-gf', label: 'Ground Floor Footfall', sublabel: 'In Count',
            color: '#00AEEF',
            extraHtml: `
              <div class="kpi-demo">
                <span class="kpi-badge" id="kpi-gf-m"><span class="badge-dot" style="background:#3B82F6"></span>M: 0 (0%)</span>
                <span class="kpi-badge" id="kpi-gf-f"><span class="badge-dot" style="background:#EC4899"></span>F: 0 (0%)</span>
                <span class="kpi-badge" id="kpi-gf-c"><span class="badge-dot" style="background:#F59E0B"></span>C: 0 (0%)</span>
              </div>`,
          })}

          ${buildKpiCard({
            id: 'kpi-greet-att', label: 'Greetings', sublabel: 'Attended / Unattended',
            color: '#00A651',
            extraHtml: `
              <div class="kpi-demo">
                <span class="kpi-badge"><span class="badge-dot" style="background:#00A651"></span>Attended: <span id="kpi-greet-att-val">0</span></span>
                <span class="kpi-badge"><span class="badge-dot" style="background:#EF4444"></span>Unattended: <span id="kpi-greet-un">0</span></span>
              </div>`,
          })}

          ${buildKpiCard({
            id: 'kpi-ff', label: 'First Floor Footfall', sublabel: 'In Count',
            color: '#F58220',
            extraHtml: `
              <div class="kpi-demo">
                <span class="kpi-badge" id="kpi-ff-m"><span class="badge-dot" style="background:#3B82F6"></span>M: 0 (0%)</span>
                <span class="kpi-badge" id="kpi-ff-f"><span class="badge-dot" style="background:#EC4899"></span>F: 0 (0%)</span>
                <span class="kpi-badge" id="kpi-ff-c"><span class="badge-dot" style="background:#F59E0B"></span>C: 0 (0%)</span>
              </div>`,
          })}

          ${buildKpiCard({
            id: 'kpi-billing', label: 'Billing', sublabel: 'Customers Transacted',
            color: '#8B5CF6',
            extraHtml: `
              <div class="kpi-status-row" id="kpi-billing-status">
                <span class="status-pill ${frame0.billingEmpPresent ? 'present' : 'absent'}" id="kpi-emp-status">
                  <span class="dot-sm"></span>Employee ${frame0.billingEmpPresent ? 'Present' : 'Absent'}
                </span>
                <span class="status-pill ${frame0.billingCustPresent ? 'present' : 'absent'}" id="kpi-cust-status">
                  <span class="dot-sm"></span>Customer ${frame0.billingCustPresent ? 'Present' : 'Absent'}
                </span>
              </div>
`,
          })}

        </div>
      </div>

      <!-- ANALYTICS ROW -->
      <div class="analytics-section">
        <div class="two-col">

          <!-- Funnel -->
          <div class="card">
            <div class="card-title">Customer Journey Funnel</div>
            <div class="card-subtitle">Live conversion from passerby to billing</div>
            <div id="funnel-mount"></div>
          </div>

          <!-- Store Performance -->
          <div class="card">
            <div class="card-title">Store Performance</div>
            <div class="card-subtitle">Conversion rates &amp; overall health</div>
            <div class="rate-cards-grid">
              ${buildRateCard('rate-capture',  'Passerby → Store Entry',  frame0.captureRate)}
              ${buildRateCard('rate-explore',  'Store Entry → 1st Floor', frame0.floorExploreRate)}
              ${buildRateCard('rate-billing',  'Store Entry → Billing',   frame0.billingRate)}
              ${buildRateCard('rate-overall',  'Overall Health Score',    frame0.healthScore / 100)}
            </div>
          </div>

        </div>
      </div>

      <!-- ZONE METRICS ROW -->
      <div class="metrics-section">
        <div class="two-col">

          <!-- Dwell Time -->
          <div class="card">
            <div class="card-title">Zone Dwell Time</div>
            <div class="card-subtitle">Average time spent per zone</div>
            <div class="dwell-rows" id="dwell-rows">
              ${buildDwellSection(frame0)}
            </div>
          </div>

          <!-- Interaction Time -->
          <div class="card">
            <div class="card-title">Customer–Employee Interaction</div>
            <div class="card-subtitle">Billing zone engagement time</div>
            <div class="interact-main">
              <div class="interact-big" id="interact-big">${frame0.interactionFmt}</div>
              <div class="interact-sublabel">Avg. Interaction Duration</div>
            </div>
            <div class="interact-bar-wrap">
              <div class="interact-bar-track">
                <div class="interact-bar" id="interact-bar" style="width:0%"></div>
              </div>
            </div>
            <div class="interact-stats">
              <div class="interact-stat">
                <div class="interact-stat-val" id="interact-emp-time">${frame0.empTimeFmt}</div>
                <div class="interact-stat-lbl">Employee Time at Counter</div>
              </div>
              <div class="interact-stat">
                <div class="interact-stat-val" id="interact-cust-billing">${frame0.billingCustomers}</div>
                <div class="interact-stat-lbl">Customers at Billing</div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- HEATMAP LEGEND -->
      <div class="heatmap-section">
        <div class="heatmap-legend-card">
          <div class="card-title">Heat Map Guide</div>
          <div class="card-subtitle" style="margin-bottom:0">Colour intensity indicates relative foot traffic concentration at each zone</div>
          <div class="heatmap-gradient-wrap">
            <div class="heatmap-gradient-bar"></div>
          </div>
          <div class="heatmap-labels">
            <div class="heatmap-label-item">
              <span class="heatmap-label-dot" style="background:#0000FF"></span>
              <span class="heatmap-label-name">Cold</span>
              <span class="heatmap-label-desc">Minimal<br/>activity</span>
            </div>
            <div class="heatmap-label-item">
              <span class="heatmap-label-dot" style="background:#00FFFF"></span>
              <span class="heatmap-label-name">Cool</span>
              <span class="heatmap-label-desc">Low<br/>traffic</span>
            </div>
            <div class="heatmap-label-item">
              <span class="heatmap-label-dot" style="background:#00CC00"></span>
              <span class="heatmap-label-name">Moderate</span>
              <span class="heatmap-label-desc">Average<br/>footfall</span>
            </div>
            <div class="heatmap-label-item">
              <span class="heatmap-label-dot" style="background:#FFFF00"></span>
              <span class="heatmap-label-name">Warm</span>
              <span class="heatmap-label-desc">Active<br/>zone</span>
            </div>
            <div class="heatmap-label-item">
              <span class="heatmap-label-dot" style="background:#FF6600"></span>
              <span class="heatmap-label-name">Hot</span>
              <span class="heatmap-label-desc">High<br/>traffic</span>
            </div>
            <div class="heatmap-label-item">
              <span class="heatmap-label-dot" style="background:#FF0000"></span>
              <span class="heatmap-label-name">Peak</span>
              <span class="heatmap-label-desc">Maximum<br/>concentration</span>
            </div>
          </div>
        </div>
      </div>

    </div><!-- /dash-body -->
  `;

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

  // ── Wire up videos ────────────────────────────────────────────────────────
  const videos = {
    passerby: document.getElementById('vid-passerby'),
    gf:       document.getElementById('vid-gf'),
    greet:    document.getElementById('vid-greet'),
    ff:       document.getElementById('vid-ff'),
    billing:  document.getElementById('vid-billing'),
    heatmap:  document.getElementById('vid-heatmap'),
  };

  videos.passerby.src = urls.passerby;
  videos.gf.src       = urls.footfallGround;
  videos.greet.src    = urls.greetings;
  videos.ff.src       = urls.footfallFirst;
  videos.billing.src  = urls.billing;
  videos.heatmap.src  = urls.heatmap;

  const master  = videos.passerby;
  const slaves  = [videos.gf, videos.greet, videos.ff, videos.billing, videos.heatmap];
  const allVids = [master, ...slaves];

  // ── Controls ──────────────────────────────────────────────────────────────
  const seekBar     = document.getElementById('seek-bar');
  const timeDisplay = document.getElementById('time-display');
  let isSeeking = false;
  let duration  = 0;

  function updateSeekFill(pctVal) {
    const p = Math.max(0, Math.min(100, pctVal));
    seekBar.style.background = `linear-gradient(to right, #2E3192 ${p}%, rgba(255,255,255,0.2) ${p}%)`;
  }

  document.getElementById('btn-play').addEventListener('click', () => {
    allVids.forEach(v => v.play());
  });
  document.getElementById('btn-pause').addEventListener('click', () => {
    allVids.forEach(v => v.pause());
  });
  document.getElementById('btn-reset').addEventListener('click', () => {
    allVids.forEach(v => { v.pause(); v.currentTime = 0; });
    seekBar.value = 0;
    updateSeekFill(0);
    timeDisplay.textContent = `0:00 / ${fmtTime(duration)}`;
    syncToFrame(0);
  });

  master.addEventListener('loadedmetadata', () => {
    duration = master.duration || 0;
    timeDisplay.textContent = `0:00 / ${fmtTime(duration)}`;
  });

  seekBar.addEventListener('mousedown', () => { isSeeking = true; });
  seekBar.addEventListener('input', () => {
    if (!duration) return;
    const t = (seekBar.value / 100) * duration;
    allVids.forEach(v => { v.currentTime = t; });
    updateSeekFill(Number(seekBar.value));
    timeDisplay.textContent = `${fmtTime(t)} / ${fmtTime(duration)}`;
    syncToFrame(t);
  });
  seekBar.addEventListener('mouseup', () => { isSeeking = false; });

  // ── Master timeupdate → sync all ──────────────────────────────────────────
  master.addEventListener('timeupdate', () => {
    const t = master.currentTime || 0;
    slaves.forEach(v => {
      if (!v.paused && Math.abs(v.currentTime - t) > SYNC_THRESHOLD) {
        v.currentTime = t;
      }
    });
    if (!isSeeking && duration > 0) {
      const pctVal = (t / duration) * 100;
      seekBar.value = pctVal;
      updateSeekFill(pctVal);
    }
    timeDisplay.textContent = `${fmtTime(t)} / ${fmtTime(duration)}`;
    syncToFrame(t);
  });

  // ── Render funnel ─────────────────────────────────────────────────────────
  const funnelMount = document.getElementById('funnel-mount');
  renderFunnel(funnelMount);
  updateFunnel(funnelMount, frame0);

  // ── syncToFrame ───────────────────────────────────────────────────────────
  function syncToFrame(currentTime) {
    const frac = duration > 0 ? currentTime / duration : 0;
    const frame = computeFrame(frac, data, currentTime);

    // Passerby
    setTxt('kpi-pb', frame.pbIn);
    setTxt('kpi-pb-m', `M: ${frame.pbMale} (${frame.pbMalePct}%)`);
    setTxt('kpi-pb-f', `F: ${frame.pbFemale} (${frame.pbFemalePct}%)`);
    setTxt('kpi-pb-c', `C: ${frame.pbChild} (${frame.pbChildPct}%)`);

    // Ground Floor
    setTxt('kpi-gf',   frame.gfIn);
    setTxt('kpi-gf-m', `M: ${frame.gfMale} (${frame.gfMalePct}%)`);
    setTxt('kpi-gf-f', `F: ${frame.gfFemale} (${frame.gfFemalePct}%)`);
    setTxt('kpi-gf-c', `C: ${frame.gfChild} (${frame.gfChildPct}%)`);

    // Greetings
    setTxt('kpi-greet-att', frame.greetAttended);
    setTxt('kpi-greet-att-val', frame.greetAttended);
    setTxt('kpi-greet-un', frame.greetUnattended);

    // First Floor
    setTxt('kpi-ff',   frame.ffIn);
    setTxt('kpi-ff-m', `M: ${frame.ffMale} (${frame.ffMalePct}%)`);
    setTxt('kpi-ff-f', `F: ${frame.ffFemale} (${frame.ffFemalePct}%)`);
    setTxt('kpi-ff-c', `C: ${frame.ffChild} (${frame.ffChildPct}%)`);

    // Billing
    setTxt('kpi-billing', frame.billingCustomers);
    updateStatusPill('kpi-emp-status',  frame.billingEmpPresent,  'Employee');
    updateStatusPill('kpi-cust-status', frame.billingCustPresent, 'Customer');

    // Funnel
    updateFunnel(funnelMount, frame);

    // Rate cards
    updateRateCard('rate-capture', frame.captureRate);
    updateRateCard('rate-explore', frame.floorExploreRate);
    updateRateCard('rate-billing', frame.billingRate);
    updateRateCard('rate-overall', frame.healthScore / 100);

    // Dwell time
    updateDwellBars(frame);

    // Interaction time
    setTxt('interact-big', frame.interactionFmt);
    setTxt('interact-emp-time', frame.empTimeFmt);
    setTxt('interact-cust-billing', frame.billingCustomers);
    const interactPct = data.maxInteract > 0
      ? Math.round((frame.interactionSec / data.maxInteract) * 100) : 0;
    const interactBar = document.getElementById('interact-bar');
    if (interactBar) interactBar.style.width = `${interactPct}%`;
  }

  // ── DOM update helpers ────────────────────────────────────────────────────
  function setTxt(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = typeof val === 'number' ? val.toLocaleString() : val;
  }

  function updateStatusPill(id, present, label) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = `status-pill ${present ? 'present' : 'absent'}`;
    el.innerHTML = `<span class="dot-sm"></span>${label} ${present ? 'Present' : 'Absent'}`;
  }

  function updateRateCard(id, rate) {
    const r = Math.min(1, Math.max(0, rate));
    const p = Math.round(r * 100);
    const color = rateColor(r);
    const arcEnd = 135 + (r * 270);
    const arcEl  = document.getElementById(`${id}-arc`);
    const pctEl  = document.getElementById(`${id}-pct`);
    const statEl = document.getElementById(`${id}-status`);

    if (arcEl) {
      const bg    = arcPath(24, 24, 18, 135, 405);
      const fill  = arcPath(24, 24, 18, 135, arcEnd);
      arcEl.setAttribute('d', fill);
      arcEl.setAttribute('stroke', color);
    }
    if (pctEl)  { pctEl.textContent = `${p}%`; pctEl.style.color = color; }
    if (statEl) { statEl.textContent = rateLabel(r); statEl.style.color = color; }
  }

  function setHealthRow(id, rate) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = pct(rate);
    el.style.color = rateColor(rate);
  }

  function updateGauge(score) {
    const scoreEl = document.getElementById('gauge-score');
    const labelEl = document.getElementById('gauge-label');
    const arcEl   = document.getElementById('gauge-arc');
    const color   = healthColor(score);
    if (scoreEl) { scoreEl.textContent = score; scoreEl.setAttribute('fill', color); }
    if (labelEl) { labelEl.textContent = healthLabel(score).toUpperCase(); labelEl.setAttribute('fill', color); }
    if (arcEl) {
      const circ   = 2 * Math.PI * 46;
      const offset = score <= 0 ? circ : circ - (score / 100) * (270 / 360) * circ;
      arcEl.setAttribute('stroke', color);
      arcEl.style.strokeDashoffset = offset;
    }
  }

  function updateDwellBars(frame) {
    const maxMin = Math.max(frame.gfDwellMin, frame.ffDwellMin, frame.billingDwellSec / 60, 0.01);
    const zones = [
      { id: 'dwell-gf',   val: frame.gfDwellMin,          fmt: frame.gfDwellFmt      },
      { id: 'dwell-ff',   val: frame.ffDwellMin,           fmt: frame.ffDwellFmt      },
      { id: 'dwell-bill', val: frame.billingDwellSec / 60, fmt: frame.billingDwellFmt },
    ];
    zones.forEach(z => {
      const valEl = document.getElementById(`${z.id}-val`);
      const barEl = document.getElementById(`${z.id}-bar`);
      if (valEl) valEl.textContent = z.fmt || '0s';
      if (barEl) barEl.style.width = `${Math.round((z.val / maxMin) * 100)}%`;
    });
  }

  // ── Initial render ────────────────────────────────────────────────────────
  syncToFrame(0);
}
