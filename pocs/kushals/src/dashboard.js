import { computeFrame, formatSeconds, MAX_CO_PRESENT_SECS } from './analytics.js';
import { renderFunnel, updateFunnel } from './funnel.js';

const SYNC_THRESHOLD = 0.15;

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

function pctBadges(mId, fId, cId) {
  return `
    <div class="kpi-demo">
      <span class="kpi-badge" id="${mId}"><span class="badge-dot" style="background:#3B82F6"></span>M: 0 (0%)</span>
      <span class="kpi-badge" id="${fId}"><span class="badge-dot" style="background:#EC4899"></span>F: 0 (0%)</span>
      <span class="kpi-badge" id="${cId}"><span class="badge-dot" style="background:#F59E0B"></span>C: 0 (0%)</span>
    </div>`;
}

// ── Jewellery Clearance Section ───────────────────────────────────────────────

function deskStateClass(state) {
  if (state === 'OCCUPIED') return 'jc-state-occupied';
  if (state === 'UNCLEAR')  return 'jc-state-unclear';
  return 'jc-state-clear';
}

function deskStateLabel(state) {
  if (state === 'OCCUPIED') return 'Jewellery on Desk';
  if (state === 'CLEAR')    return 'Clear Desk';
  return state;
}

function buildJcSection(frame) {
  const cls = deskStateClass(frame.deskState);
  return `
    <div class="card jc-card">
      <div class="card-title">Jewellery Desk Status</div>
      <div class="card-subtitle">Real-time desk state from jewellery clearance camera</div>
      <div class="jc-body">
        <span class="jc-state-pill ${cls}" id="jc-state-pill">${deskStateLabel(frame.deskState)}</span>
        <div class="jc-presence-row">
          <span class="jc-pill ${frame.jcEmpPresent ? 'jc-pill-present' : 'jc-pill-absent'}" id="jc-emp-pill">
            Employee ${frame.jcEmpPresent ? 'Present' : 'Absent'}
          </span>
          <span class="jc-pill ${frame.jcCustPresent ? 'jc-pill-present' : 'jc-pill-absent'}" id="jc-cust-pill">
            Customer ${frame.jcCustPresent ? 'Present' : 'Absent'}
          </span>
        </div>
      </div>
    </div>`;
}

// ── Main Render ───────────────────────────────────────────────────────────────

export function renderDashboard(app, data, urls) {
  const frame0 = computeFrame(0, data, 0);

  app.innerHTML = `
    <!-- HEADER -->
    <header class="dash-header">
      <div class="header-xr-block">
        <img src="/xenlogo.png" alt="XenReality" />
      </div>
      <div class="header-title">PoC Dashboard</div>
      <div class="header-right">
        <div class="header-datetime">
          <span class="header-date" id="hdr-date"></span>
          <span class="header-time" id="hdr-time"></span>
        </div>
        <div class="header-live-pill"><span class="live-dot"></span>Live</div>
        <img class="header-customer-logo" src="${urls.logo}" alt="Kushals" onerror="this.style.display='none'" />
        <button class="header-signout" title="Sign out" onclick="(function(){try{localStorage.removeItem('pocketbase_auth');}catch(e){}window.location.reload();})()"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>
      </div>
    </header>

    <!-- BODY -->
    <div class="dash-body">

      <!-- VIDEOS -->
      <div class="video-section">
        <div class="video-grid video-grid-5">
          <div class="video-tile">
            <video id="vid-passerby" preload="metadata" playsinline></video>
            <div class="video-tile-label">Passerby</div>
          </div>
          <div class="video-tile">
            <video id="vid-footfall" preload="metadata" playsinline></video>
            <div class="video-tile-label">Footfall</div>
          </div>
          <div class="video-tile">
            <video id="vid-greet" preload="metadata" playsinline></video>
            <div class="video-tile-label">Greetings</div>
          </div>
          <div class="video-tile">
            <video id="vid-emp" preload="metadata" playsinline></video>
            <div class="video-tile-label">Total Employees</div>
          </div>
          <div class="video-tile">
            <video id="vid-jc" preload="metadata" playsinline></video>
            <div class="video-tile-label">Jewellery Clearance</div>
          </div>
        </div>

        <div class="video-controls">
          <button class="ctrl-btn ctrl-btn-play" id="btn-play">&#9654; Play All</button>
          <button class="ctrl-btn ctrl-btn-pause" id="btn-pause">&#9646;&#9646; Pause</button>
          <button class="ctrl-btn ctrl-btn-reset" id="btn-reset">&#8635; Reset</button>
          <button class="ctrl-btn ctrl-btn-speed" id="btn-speed">1x Speed</button>
          <div class="video-seek-wrap">
            <input type="range" class="seek-bar" id="seek-bar" min="0" max="100" value="0" step="0.1" />
            <span class="time-display" id="time-display">0:00 / 0:00</span>
          </div>
        </div>
      </div>

      <!-- KPI CARDS -->
      <div class="kpi-section">
        <div class="section-label">Key Performance Indicators</div>
        <div class="kpi-grid kpi-grid-4">

          ${buildKpiCard({
            id: 'kpi-pb', label: 'Passerby', sublabel: 'Outside Store',
            color: '#2E3192',
            extraHtml: pctBadges('kpi-pb-m', 'kpi-pb-f', 'kpi-pb-c'),
          })}

          ${buildKpiCard({
            id: 'kpi-ft', label: 'Footfall', sublabel: 'In Count',
            color: '#00AEEF',
            extraHtml: pctBadges('kpi-ft-m', 'kpi-ft-f', 'kpi-ft-c') + `
              <div class="kpi-demo" style="margin-top:4px"><span class="kpi-badge" id="kpi-ft-groups"><span class="badge-dot" style="background:#00AEEF"></span>Groups: <span id="kpi-ft-group-val">1</span></span></div>`,
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
            id: 'kpi-emp', label: 'Employee Count', sublabel: 'Total Employees on Floor',
            color: '#F58220',
          })}

        </div>
      </div>

      <!-- ANALYTICS ROW -->
      <div class="analytics-section">
        <div class="two-col">

          <!-- Funnel -->
          <div class="card">
            <div class="card-title">Customer Journey Funnel</div>
            <div class="card-subtitle">Live conversion from passerby to store entry</div>
            <div id="funnel-mount"></div>
          </div>

          <!-- Store Performance -->
          <div class="card">
            <div class="card-title">Store Performance</div>
            <div class="card-subtitle">Passerby to store entry conversion rate</div>
            <div class="rate-cards-grid rate-cards-single">
              ${buildRateCard('rate-capture', 'Passerby → Store Entry', frame0.captureRate)}
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
            <div class="card-subtitle">Average time spent in store</div>
            <div class="dwell-rows" id="dwell-rows">
              <div class="dwell-row-item">
                <div class="dwell-label-row">
                  <span class="dwell-zone-name">
                    <span class="dwell-zone-dot" style="background:#00AEEF"></span>
                    Ground Floor (Store)
                  </span>
                  <span class="dwell-value" id="dwell-ft-val">${frame0.ftDwellFmt || '0s'}</span>
                </div>
                <div class="dwell-track">
                  <div class="dwell-bar" id="dwell-ft-bar" style="background:#00AEEF; width:0%"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Interaction Time -->
          <div class="card">
            <div class="card-title">Customer–Employee Interaction</div>
            <div class="card-subtitle">Cumulative time both employee &amp; customer were present together</div>
            <div class="interact-main">
              <div class="interact-big" id="interact-big">${frame0.interactionFmt}</div>
              <div class="interact-sublabel">Total Co-Presence Time</div>
            </div>
            <div class="interact-bar-wrap">
              <div class="interact-bar-track">
                <div class="interact-bar" id="interact-bar" style="width:0%"></div>
              </div>
            </div>
            <div class="interact-stats">
              <div class="interact-stat">
                <div class="interact-stat-val ${frame0.jcEmpPresent ? 'stat-present' : 'stat-absent'}" id="interact-emp-status">
                  ${frame0.jcEmpPresent ? 'Present' : 'Absent'}
                </div>
                <div class="interact-stat-lbl">Employee at Desk</div>
              </div>
              <div class="interact-stat">
                <div class="interact-stat-val ${frame0.jcCustPresent ? 'stat-present' : 'stat-absent'}" id="interact-cust-status">
                  ${frame0.jcCustPresent ? 'Present' : 'Absent'}
                </div>
                <div class="interact-stat-lbl">Customer at Desk</div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- JEWELLERY CLEARANCE SECTION -->
      <div class="jc-section">
        ${buildJcSection(frame0)}
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
  const vidPasserby  = document.getElementById('vid-passerby');
  const vidFootfall  = document.getElementById('vid-footfall');
  const vidGreet     = document.getElementById('vid-greet');
  const vidEmp       = document.getElementById('vid-emp');
  const vidJc        = document.getElementById('vid-jc');

  vidPasserby.src = urls.passerby;
  vidFootfall.src = urls.footfall;
  vidGreet.src    = urls.greetings;
  vidEmp.src      = urls.totalEmployees;
  vidJc.src       = urls.jewelleryClr;

  const master  = vidPasserby;
  const slaves  = [vidFootfall, vidGreet, vidEmp, vidJc];
  const allVids = [master, ...slaves];

  // ── Controls ──────────────────────────────────────────────────────────────
  const seekBar     = document.getElementById('seek-bar');
  const timeDisplay = document.getElementById('time-display');
  let isSeeking     = false;
  let duration      = 0;
  let playbackSpeed = 1;

  function updateSeekFill(pctVal) {
    const p = Math.max(0, Math.min(100, pctVal));
    seekBar.style.background = `linear-gradient(to right, #2E3192 ${p}%, rgba(255,255,255,0.2) ${p}%)`;
  }

  document.getElementById('btn-play').addEventListener('click', () => {
    const t = master.currentTime || 0;
    // Only seek slaves that have drifted; a forced seek on every resume
    // causes buffering delay and makes slaves start late.
    slaves.forEach(v => {
      if (Math.abs(v.currentTime - t) > SYNC_THRESHOLD) v.currentTime = t;
    });
    allVids.forEach(v => v.play());
  });
  document.getElementById('btn-pause').addEventListener('click', () => {
    allVids.forEach(v => v.pause());
  });
  document.getElementById('btn-reset').addEventListener('click', () => {
    allVids.forEach(v => { v.pause(); v.currentTime = 0; v.playbackRate = 1; });
    playbackSpeed = 1;
    document.getElementById('btn-speed').textContent = '1x Speed';
    seekBar.value = 0;
    updateSeekFill(0);
    timeDisplay.textContent = `0:00 / ${fmtTime(duration)}`;
    syncToFrame(0);
  });

  const SPEED_STEPS = [1, 1.25, 1.5, 1.75, 2];
  document.getElementById('btn-speed').addEventListener('click', () => {
    const idx = SPEED_STEPS.indexOf(playbackSpeed);
    playbackSpeed = SPEED_STEPS[(idx + 1) % SPEED_STEPS.length];
    allVids.forEach(v => { v.playbackRate = playbackSpeed; });
    document.getElementById('btn-speed').textContent = `${playbackSpeed}x Speed`;
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

  // ── When passerby ends, pause all slaves so they don't play past sync ─────
  master.addEventListener('ended', () => {
    slaves.forEach(v => v.pause());
  });

  // ── Force-sync slaves immediately on seek ─────────────────────────────────
  master.addEventListener('seeked', () => {
    const t = master.currentTime || 0;
    slaves.forEach(v => { v.currentTime = t; });
  });

  // ── Pre-compute session max dwell for bar normalization ───────────────────
  const maxFtDwell = Math.max(...data.ftDwellTimes, 1);

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

    // Footfall
    setTxt('kpi-ft', frame.ftIn);
    setTxt('kpi-ft-m', `M: ${frame.ftMale} (${frame.ftMalePct}%)`);
    setTxt('kpi-ft-f', `F: ${frame.ftFemale} (${frame.ftFemalePct}%)`);
    setTxt('kpi-ft-c', `C: ${frame.ftChild} (${frame.ftChildPct}%)`);
    setTxt('kpi-ft-group-val', frame.ftGroupCount);

    // Greetings
    setTxt('kpi-greet-att', frame.greetAttended);
    setTxt('kpi-greet-att-val', frame.greetAttended);
    setTxt('kpi-greet-un', frame.greetUnattended);

    // Employee count
    setTxt('kpi-emp', frame.employeeCount);

    // Funnel
    updateFunnel(funnelMount, frame);

    // Rate card
    updateRateCard('rate-capture', frame.captureRate);

    // Dwell time
    const valEl = document.getElementById('dwell-ft-val');
    const barEl = document.getElementById('dwell-ft-bar');
    if (valEl) valEl.textContent = frame.ftDwellFmt || '0s';
    if (barEl) {
      const rawIdx = Math.min(Math.floor(frac * data.ftDwellTimes.length), data.ftDwellTimes.length - 1);
      const rawDwell = data.ftDwellTimes[rawIdx] || 0;
      barEl.style.width = `${Math.round((rawDwell / maxFtDwell) * 100)}%`;
    }

    // Interaction — co-presence time (hardcoded, already in real seconds)
    setTxt('interact-big', frame.interactionFmt);
    const interactPct = Math.round(Math.min(100, (frame.interactionSecs / MAX_CO_PRESENT_SECS) * 100));
    const interactBarEl = document.getElementById('interact-bar');
    if (interactBarEl) interactBarEl.style.width = `${interactPct}%`;
    updatePresenceStat('interact-emp-status', frame.jcEmpPresent, 'Employee at Desk');
    updatePresenceStat('interact-cust-status', frame.jcCustPresent, 'Customer at Desk');

    // Jewellery Clearance section
    updateJcSection(frame);
  }

  // ── DOM helpers ───────────────────────────────────────────────────────────
  function setTxt(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = typeof val === 'number' ? val.toLocaleString() : val;
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
      arcEl.setAttribute('d', arcPath(24, 24, 18, 135, arcEnd));
      arcEl.setAttribute('stroke', color);
    }
    if (pctEl)  { pctEl.textContent = `${p}%`; pctEl.style.color = color; }
    if (statEl) { statEl.textContent = rateLabel(r); statEl.style.color = color; }
  }

  function updatePresenceStat(id, present, label) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = `interact-stat-val ${present ? 'stat-present' : 'stat-absent'}`;
    el.textContent = present ? 'Present' : 'Absent';
  }

  function updateJcSection(frame) {
    const pillEl = document.getElementById('jc-state-pill');
    const empEl  = document.getElementById('jc-emp-pill');
    const custEl = document.getElementById('jc-cust-pill');

    if (pillEl) {
      pillEl.className = `jc-state-pill ${deskStateClass(frame.deskState)}`;
      pillEl.textContent = deskStateLabel(frame.deskState);
    }
    if (empEl) {
      empEl.className = `jc-pill ${frame.jcEmpPresent ? 'jc-pill-present' : 'jc-pill-absent'}`;
      empEl.textContent = `Employee ${frame.jcEmpPresent ? 'Present' : 'Absent'}`;
    }
    if (custEl) {
      custEl.className = `jc-pill ${frame.jcCustPresent ? 'jc-pill-present' : 'jc-pill-absent'}`;
      custEl.textContent = `Customer ${frame.jcCustPresent ? 'Present' : 'Absent'}`;
    }
  }

  // ── Initial render ────────────────────────────────────────────────────────
  syncToFrame(0);
}
