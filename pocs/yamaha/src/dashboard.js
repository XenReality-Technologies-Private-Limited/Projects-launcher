import { findRow } from './db.js';

const SYNC_THRESHOLD = 0.15;

function fmtTime(sec) {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function fmtMmSs(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtDwell(secs) {
  const s = Math.round(secs);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r > 0 ? `${m}m ${r}s` : `${m}m`;
}

// Employee presence intervals (hardcoded):
// [0, 5)   → present
// [5, 72)  → absent
// [72, 160) → present  (1:12 – 2:40)
// [160, 274) → absent
// [274, end) → present (4:34 – end)
// Customers always 2 throughout.

function empPresent(t) {
  return (t < 5 || (t >= 72 && t < 160) || t >= 274) ? 1 : 0;
}

function cumulativeInteraction(t) {
  let cum = Math.max(0, Math.min(t, 5));           // [0, 5)
  if (t > 72)  cum += Math.min(t, 160) - 72;       // [72, 160)
  if (t > 274) cum += t - 274;                      // [274, end)
  return Math.floor(cum);
}

// Max at full video (14:59 = 899s): 5 + 88 + 625 = 718s
const MAX_INTERACTION_SECS = 718;

function greetingsGreeted(t) {
  if (t >= 529) return 3;
  if (t >= 527) return 2;
  if (t >= 386) return 1;
  return 0;
}

function greetingsUnattended(t) {
  if (t >= 530) return 3;
  if (t >= 111) return 2;
  if (t >= 110) return 1;
  return 0;
}

function pctOf(n, total) {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

function rateColor(r) {
  if (r >= 0.5) return '#10B981';
  if (r >= 0.25) return '#F59E0B';
  return '#EF4444';
}
function rateLabel(r) {
  if (r >= 0.5) return 'Excellent';
  if (r >= 0.25) return 'Good';
  return 'Can Improve';
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  const rad = (d) => (d * Math.PI) / 180;
  const lg  = endDeg - startDeg > 180 ? 1 : 0;
  const sx = cx + r * Math.cos(rad(startDeg)), sy = cy + r * Math.sin(rad(startDeg));
  const ex = cx + r * Math.cos(rad(endDeg)),   ey = cy + r * Math.sin(rad(endDeg));
  return `M ${sx} ${sy} A ${r} ${r} 0 ${lg} 1 ${ex} ${ey}`;
}

const ARC_BG = arcPath(24, 24, 18, 135, 405);

export function renderDashboard(app, data, videos) {
  app.innerHTML = `
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
        <img class="header-customer-logo" src="/yamaha/thomsun-logo.png" alt="Thomsun" onerror="this.style.display='none'" />
        <button class="header-signout" title="Sign out" onclick="(function(){try{localStorage.removeItem('pocketbase_auth');}catch(e){}window.location.reload();})()"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>
      </div>
    </header>
    <nav class="dash-tabs" id="view-toggle">
      <button class="dash-tab active" id="btn-poc">PoC</button>
      <button class="dash-tab" id="btn-live">Yamaha</button>
      <button class="dash-tab" id="btn-fb">Fresh-Bakes</button>
    </nav>

    <iframe id="live-frame" src="" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:200;"></iframe>
    <iframe id="fb-frame"   src="" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:200;"></iframe>

    <div class="dash-body" id="poc-body">

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
            <video id="vid-greetings" preload="metadata" playsinline></video>
            <div class="video-tile-label">Greetings</div>
          </div>
          <div class="video-tile">
            <video id="vid-emp" preload="metadata" playsinline></video>
            <div class="video-tile-label">Employee - Customer Interaction</div>
          </div>
          <div class="video-tile">
            <video id="vid-heatmap" preload="metadata" playsinline></video>
            <div class="video-tile-label">Heatmap</div>
          </div>
        </div>

        <div class="video-controls">
          <button class="ctrl-btn ctrl-btn-play"  id="btn-play">&#9654; Play All</button>
          <button class="ctrl-btn ctrl-btn-pause" id="btn-pause">&#9646;&#9646; Pause</button>
          <button class="ctrl-btn ctrl-btn-reset" id="btn-reset">&#8635; Reset</button>
          <button class="ctrl-btn ctrl-btn-speed" id="btn-speed">1x Speed</button>
          <div class="video-seek-wrap">
            <input type="range" class="seek-bar" id="seek-bar" min="0" max="100" value="0" step="0.1" />
            <span class="time-display" id="time-display">0:00 / 0:00</span>
          </div>
        </div>
      </div>

      <!-- KPI CARDS: 5 cards -->
      <div class="kpi-section">
        <div class="section-label">Key Performance Indicators</div>
        <div class="kpi-grid">

          <!-- Passerby: IN+OUT combined, M/F/C breakdown -->
          <div class="kpi-card fade-in" style="--kpi-color:#003087">
            <div class="kpi-label">Passerby</div>
            <div class="kpi-value" id="kpi-pb">0</div>
            <div class="kpi-sub">Total (In + Out)</div>
            <div class="kpi-demo" style="margin-top:4px;">
              <span class="kpi-badge" id="kpi-pb-m"><span class="badge-dot" style="background:#3B82F6"></span>M: 0 (0%)</span>
              <span class="kpi-badge" id="kpi-pb-f"><span class="badge-dot" style="background:#EC4899"></span>F: 0 (0%)</span>
              <span class="kpi-badge" id="kpi-pb-c"><span class="badge-dot" style="background:#F59E0B"></span>C: 0 (0%)</span>
            </div>
          </div>

          <!-- Footfall: IN count only -->
          <div class="kpi-card fade-in" style="--kpi-color:#00AEEF">
            <div class="kpi-label">Footfall</div>
            <div class="kpi-value" id="kpi-ft">0</div>
            <div class="kpi-sub">In Count</div>
            <div class="kpi-demo" style="margin-top:4px;">
              <span class="kpi-badge" id="kpi-ft-m"><span class="badge-dot" style="background:#3B82F6"></span>M: 0 (0%)</span>
              <span class="kpi-badge" id="kpi-ft-f"><span class="badge-dot" style="background:#EC4899"></span>F: 0 (0%)</span>
              <span class="kpi-badge" id="kpi-ft-c"><span class="badge-dot" style="background:#F59E0B"></span>C: 0 (0%)</span>
            </div>
          </div>

          <!-- Greetings: Greeted | Unattended side-by-side -->
          <div class="kpi-card fade-in" style="--kpi-color:#00A651">
            <div class="kpi-label">Greetings</div>
            <div class="kpi-inout-grid" style="margin-top:4px;">
              <div class="kpi-inout-col">
                <div class="kpi-inout-lbl">Greeted</div>
                <div class="kpi-inout-num" id="kpi-greet-grd" style="color:#00A651;">0</div>
              </div>
              <div class="kpi-inout-col">
                <div class="kpi-inout-lbl">Unattended</div>
                <div class="kpi-inout-num" id="kpi-greet-un" style="color:#EF4444;">0</div>
              </div>
            </div>
          </div>

          <!-- Store Performance: Passerby → Store Entry conversion rate -->
          <div class="kpi-card fade-in" style="--kpi-color:#EF4444">
            <div class="kpi-label">Store Performance</div>
            <div class="kpi-value" id="kpi-sp-pct" style="color:#EF4444">0%</div>
            <div class="kpi-sub">Passerby → Store Entry</div>
            <div class="kpi-demo" style="margin-top:4px;">
              <span class="kpi-badge" id="kpi-sp-status" style="background:rgba(239,68,68,.12);color:#EF4444;border-color:rgba(239,68,68,.35);">Can Improve</span>
            </div>
          </div>

          <!-- Dwell Time -->
          <div class="kpi-card fade-in" style="--kpi-color:#F97316">
            <div class="kpi-label">Dwell Time</div>
            <div class="kpi-value" id="kpi-dwell-kpi" style="color:#F97316">0s</div>
            <div class="kpi-sub">Avg Time in Store</div>
          </div>

        </div>
      </div>

      <!-- ANALYTICS: Funnel + Store Performance -->
      <div class="analytics-section">
        <div class="two-col">

          <div class="card">
            <div class="card-title">Customer Journey Funnel</div>
            <div class="card-subtitle">Live conversion from passerby to store entry</div>
            <div class="funnel-wrap">
              <div class="funnel-stage">
                <div class="funnel-stage-header">
                  <div class="funnel-dot" style="background:#003087"></div>
                  <span class="funnel-stage-label">Passerby</span>
                  <span class="funnel-stage-sublabel">Outside Store</span>
                  <span class="funnel-stage-count" id="funnel-pb-count">0</span>
                </div>
                <div class="funnel-bar-track">
                  <div class="funnel-bar" id="funnel-pb-bar" style="background:#003087;width:0%"></div>
                </div>
              </div>
              <div class="funnel-connector">
                <span class="funnel-arrow">↓</span>
                <span class="funnel-pct-badge" id="funnel-pct-badge" style="background:#003087">0%</span>
                <span class="funnel-conv-label">conversion</span>
              </div>
              <div class="funnel-stage">
                <div class="funnel-stage-header">
                  <div class="funnel-dot" style="background:#00AEEF"></div>
                  <span class="funnel-stage-label">Footfall</span>
                  <span class="funnel-stage-sublabel">Store Entry</span>
                  <span class="funnel-stage-count" id="funnel-ft-count">0</span>
                </div>
                <div class="funnel-bar-track">
                  <div class="funnel-bar" id="funnel-ft-bar" style="background:#00AEEF;width:0%"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">Employee - Customer Interaction</div>
            <div class="card-subtitle">Cumulative time both employee &amp; customer were present together</div>
            <div class="interact-main">
              <div class="interact-big" id="istat-int-time">0s</div>
              <div class="interact-sublabel">Total Co-Presence Time</div>
            </div>
            <div class="interact-bar-wrap">
              <div class="interact-bar-track">
                <div class="interact-bar" id="istat-int-bar" style="width:0%"></div>
              </div>
            </div>
            <div class="interact-stats">
              <div class="interact-stat">
                <div class="interact-stat-val" id="istat-emp-status" style="color:#10B981;">Present</div>
                <div class="interact-stat-lbl">Employee at Store</div>
              </div>
              <div class="interact-stat">
                <div class="interact-stat-val" id="istat-cust-status" style="color:#10B981;">Present</div>
                <div class="interact-stat-lbl">Customers at Store</div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- HEATMAP GUIDE -->
      <div class="heatmap-section">
        <div class="heatmap-legend-card">
          <div class="card-title">Heat Map Guide</div>
          <div class="card-subtitle">Colour intensity indicates relative foot traffic concentration at each zone</div>
          <div class="heatmap-gradient-wrap">
            <div class="heatmap-gradient-bar"></div>
          </div>
          <div class="heatmap-labels">
            <div class="heatmap-label-item">
              <div class="heatmap-label-dot" style="background:#0000FF"></div>
              <div class="heatmap-label-name">Cold</div>
              <div class="heatmap-label-desc">Minimal traffic</div>
            </div>
            <div class="heatmap-label-item">
              <div class="heatmap-label-dot" style="background:#00FFFF"></div>
              <div class="heatmap-label-name">Cool</div>
              <div class="heatmap-label-desc">Low traffic</div>
            </div>
            <div class="heatmap-label-item">
              <div class="heatmap-label-dot" style="background:#00CC00"></div>
              <div class="heatmap-label-name">Moderate</div>
              <div class="heatmap-label-desc">Average traffic</div>
            </div>
            <div class="heatmap-label-item">
              <div class="heatmap-label-dot" style="background:#FFFF00"></div>
              <div class="heatmap-label-name">Warm</div>
              <div class="heatmap-label-desc">Above average</div>
            </div>
            <div class="heatmap-label-item">
              <div class="heatmap-label-dot" style="background:#FF6600"></div>
              <div class="heatmap-label-name">Hot</div>
              <div class="heatmap-label-desc">High traffic</div>
            </div>
            <div class="heatmap-label-item">
              <div class="heatmap-label-dot" style="background:#FF0000"></div>
              <div class="heatmap-label-name">Peak</div>
              <div class="heatmap-label-desc">Maximum traffic</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  `;

  // ── Wire videos ──────────────────────────────────────────────────────────
  const vidPasserby  = document.getElementById('vid-passerby');
  const vidFootfall  = document.getElementById('vid-footfall');
  const vidGreetings = document.getElementById('vid-greetings');
  const vidEmp       = document.getElementById('vid-emp');
  const vidHeatmap   = document.getElementById('vid-heatmap');

  vidPasserby.src  = videos.passerby;
  vidFootfall.src  = videos.footfall;
  vidGreetings.src = videos.greetings;
  vidEmp.src       = videos.empInteract;
  vidHeatmap.src   = videos.heatmap;

  const master  = vidPasserby;
  const slaves  = [vidFootfall, vidGreetings, vidEmp, vidHeatmap];
  const allVids = [master, ...slaves];

  // ── Controls ─────────────────────────────────────────────────────────────
  const seekBar     = document.getElementById('seek-bar');
  const timeDisplay = document.getElementById('time-display');
  let isSeeking     = false;
  let duration      = 0;
  let playbackSpeed = 1;

  function updateSeekFill(pctVal) {
    const p = Math.max(0, Math.min(100, pctVal));
    seekBar.style.background = `linear-gradient(to right, #003087 ${p}%, rgba(255,255,255,0.2) ${p}%)`;
  }

  document.getElementById('btn-play').addEventListener('click', () => {
    const t = master.currentTime || 0;
    slaves.forEach(v => { if (Math.abs(v.currentTime - t) > SYNC_THRESHOLD) v.currentTime = t; });
    allVids.forEach(v => v.play());
  });
  document.getElementById('btn-pause').addEventListener('click', () => allVids.forEach(v => v.pause()));
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

  master.addEventListener('timeupdate', () => {
    const t = master.currentTime || 0;
    slaves.forEach(v => { if (!v.paused && Math.abs(v.currentTime - t) > SYNC_THRESHOLD) v.currentTime = t; });
    if (!isSeeking && duration > 0) {
      const pctVal = (t / duration) * 100;
      seekBar.value = pctVal;
      updateSeekFill(pctVal);
    }
    timeDisplay.textContent = `${fmtTime(t)} / ${fmtTime(duration)}`;
    syncToFrame(t);
  });

  master.addEventListener('ended', () => slaves.forEach(v => v.pause()));
  master.addEventListener('seeked', () => {
    const t = master.currentTime || 0;
    slaves.forEach(v => { v.currentTime = t; });
  });

  // ── DOM helpers ────────────────────────────────────────────────────────────
  function setTxt(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = typeof val === 'number' ? val.toLocaleString() : val;
  }

  function updateRateArc(rate) {
    const r     = Math.min(1, Math.max(0, rate));
    const color = rateColor(r);
    const arcEl = document.getElementById('rate-arc');
    const pctEl = document.getElementById('rate-pct');
    const stEl  = document.getElementById('rate-status');
    if (arcEl) { arcEl.setAttribute('d', arcPath(24, 24, 18, 135, 135 + r * 270)); arcEl.setAttribute('stroke', color); }
    if (pctEl) { pctEl.textContent = `${Math.round(r * 100)}%`; pctEl.style.color = color; }
    if (stEl)  { stEl.textContent = rateLabel(r); stEl.style.color = color; }
  }

  // ── syncToFrame ───────────────────────────────────────────────────────────
  function syncToFrame(t) {
    // Passerby: show in+out combined with M/F/C breakdown
    const pbRow = findRow(data.passerby, t);
    let pbTotal = 0, pbM = 0, pbF = 0, pbC = 0;
    if (pbRow) {
      pbM = (pbRow.in[0] || 0) + (pbRow.out[0] || 0);
      pbF = (pbRow.in[1] || 0) + (pbRow.out[1] || 0);
      pbC = (pbRow.in[2] || 0) + (pbRow.out[2] || 0);
      pbTotal = pbM + pbF + pbC;
    }
    setTxt('kpi-pb',   pbTotal);
    setTxt('kpi-pb-m', `M: ${pbM} (${pctOf(pbM, pbTotal)}%)`);
    setTxt('kpi-pb-f', `F: ${pbF} (${pctOf(pbF, pbTotal)}%)`);
    setTxt('kpi-pb-c', `C: ${pbC} (${pctOf(pbC, pbTotal)}%)`);

    // Footfall: in count only, 2s display delay + initial offset of 2
    const FOOTFALL_INITIAL = 2;
    const ftRow = findRow(data.footfall, Math.max(0, t - 2));
    let fm = 0, ff = 0, fc = 0;
    if (ftRow) [fm, ff, fc] = ftRow.in;
    const ftIn    = fm + ff + fc;
    const ftTotal = ftIn + FOOTFALL_INITIAL;
    setTxt('kpi-ft',   ftTotal);
    setTxt('kpi-ft-m', `M: ${fm} (${pctOf(fm, ftTotal)}%)`);
    setTxt('kpi-ft-f', `F: ${ff} (${pctOf(ff, ftTotal)}%)`);
    setTxt('kpi-ft-c', `C: ${fc} (${pctOf(fc, ftTotal)}%)`);

    // Greetings (hardcoded step functions)
    setTxt('kpi-greet-grd', greetingsGreeted(t));
    setTxt('kpi-greet-un',  greetingsUnattended(t));

    // Funnel: passerby bar scales to session max; footfall relative to passerby
    const pbBarEl = document.getElementById('funnel-pb-bar');
    const ftBarEl = document.getElementById('funnel-ft-bar');
    setTxt('funnel-pb-count', pbTotal);
    setTxt('funnel-ft-count', ftTotal);
    if (pbBarEl) pbBarEl.style.width = pbTotal > 0 ? '100%' : '0%';
    if (ftBarEl) ftBarEl.style.width = pbTotal > 0 ? `${Math.min(100, Math.round((ftTotal / pbTotal) * 100))}%` : '0%';
    const convRate = Math.min(1, pbTotal > 0 ? ftTotal / pbTotal : 0);
    setTxt('funnel-pct-badge', `${Math.round(convRate * 100)}%`);

    // Store Performance KPI card
    const spColor  = rateColor(convRate);
    const spLabel  = rateLabel(convRate);
    const spPctEl  = document.getElementById('kpi-sp-pct');
    const spStatEl = document.getElementById('kpi-sp-status');
    if (spPctEl)  { spPctEl.textContent = `${Math.round(convRate * 100)}%`; spPctEl.style.color = spColor; }
    if (spStatEl) { spStatEl.textContent = spLabel; spStatEl.style.color = spColor; spStatEl.style.background = spColor + '22'; spStatEl.style.borderColor = spColor + '88'; }

    // Dwell Time KPI card
    const ftIdx = data.footfall.findIndex(r => r.t > t);
    const dwellIdx = ftIdx > 0 ? ftIdx - 1 : (ftIdx === -1 ? data.ftDwellTimes.length - 1 : 0);
    const dwellSecs = data.ftDwellTimes[dwellIdx] || 0;
    setTxt('kpi-dwell-kpi', fmtDwell(dwellSecs));

    // Employee-Customer Interaction (hardcoded)
    const intSecs = cumulativeInteraction(t);
    setTxt('istat-int-time', fmtDwell(intSecs));
    const intBarEl = document.getElementById('istat-int-bar');
    if (intBarEl) intBarEl.style.width = `${Math.round((intSecs / MAX_INTERACTION_SECS) * 100)}%`;
    const empStatusEl = document.getElementById('istat-emp-status');
    if (empStatusEl) {
      const present = empPresent(t) === 1;
      empStatusEl.textContent = present ? 'Present' : 'Absent';
      empStatusEl.style.color = present ? '#10B981' : '#EF4444';
    }
    const custStatusEl = document.getElementById('istat-cust-status');
    if (custStatusEl) { custStatusEl.textContent = 'Present'; custStatusEl.style.color = '#10B981'; }
  }

  syncToFrame(0);

  // ── PoC / Live / Fresh-Bakes toggle ─────────────────────────────────────
  const pocBody      = document.getElementById('poc-body');
  const liveFrame    = document.getElementById('live-frame');
  const fbFrame      = document.getElementById('fb-frame');
  const btnPoc       = document.getElementById('btn-poc');
  const btnLive      = document.getElementById('btn-live');
  const btnFb        = document.getElementById('btn-fb');
  const dashHeader   = document.querySelector('.dash-header');
  const headerTitle   = dashHeader.querySelector('.header-title');
  const headerXrBlock = dashHeader.querySelector('.header-xr-block');
  const customerLogo  = dashHeader.querySelector('.header-customer-logo');

  function hideAllFrames() {
    liveFrame.style.display = 'none';
    fbFrame.style.display   = 'none';
  }

  function setHeaderOverlay(on) {
    dashHeader.style.background    = on ? 'transparent' : '';
    dashHeader.style.boxShadow     = on ? 'none'        : '';
    dashHeader.style.pointerEvents = on ? 'none'        : '';
    dashHeader.querySelector('.header-right').style.pointerEvents = on ? 'auto' : '';
    headerTitle.style.visibility   = on ? 'hidden' : '';
    headerXrBlock.style.visibility = on ? 'hidden' : '';
  }

  function clearToggle() {
    [btnPoc, btnLive, btnFb].forEach(b => b.classList.remove('active'));
  }

  btnLive.addEventListener('click', () => {
    allVids.forEach(v => v.pause());
    pocBody.style.display = 'none';
    hideAllFrames();
    if (!liveFrame.src || liveFrame.src === location.href) liveFrame.src = 'https://aws.xenreality.com/';
    liveFrame.style.display = 'block';
    setHeaderOverlay(true);
    if (customerLogo) customerLogo.style.visibility = '';
    clearToggle(); btnLive.classList.add('active');
  });

  btnFb.addEventListener('click', () => {
    allVids.forEach(v => v.pause());
    pocBody.style.display = 'none';
    hideAllFrames();
    if (!fbFrame.src || fbFrame.src === location.href) fbFrame.src = 'https://arvind.xenreality.com/';
    fbFrame.style.display = 'block';
    setHeaderOverlay(true);
    if (customerLogo) customerLogo.style.visibility = '';
    clearToggle(); btnFb.classList.add('active');
  });

  btnPoc.addEventListener('click', () => {
    hideAllFrames();
    pocBody.style.display = '';
    setHeaderOverlay(false);
    if (customerLogo) customerLogo.style.visibility = '';
    clearToggle(); btnPoc.classList.add('active');
  });

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
}
