import { findRow } from './db.js';

const CF       = 'https://d2uimaqek2eby3.cloudfront.net/V%20Bazaar';
const LOGO     = `${CF}/V-Bazaar-logo.png`;
const LIVE_URL = 'https://xentrack.xenreality.com/vBazaarLive/';

const SYNC_THRESHOLD = 0.15;

function fmtTime(sec) {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function fmtMmSs(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function pctOf(n, total) {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

function queueColor(count) {
  if (count < 2)  return { label: 'Queue < 2',   color: '#10B981' };
  if (count <= 3) return { label: 'Queue 2 – 3', color: '#F59E0B' };
  return                  { label: 'Queue > 3',  color: '#EF4444' };
}

export function renderDashboard(app, data, videos) {
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

    <div class="dash-body" id="poc-body">

      <!-- Shared video controls -->
      <div class="controls-bar">
        <button class="ctrl-btn ctrl-btn-play"  id="btn-play">&#9654; Play All</button>
        <button class="ctrl-btn ctrl-btn-pause" id="btn-pause">&#9646;&#9646; Pause</button>
        <button class="ctrl-btn ctrl-btn-reset" id="btn-reset">&#8635; Reset</button>
        <button class="ctrl-btn ctrl-btn-speed" id="btn-speed">1x Speed</button>
        <div class="video-seek-wrap">
          <input type="range" class="seek-bar" id="seek-bar" min="0" max="100" value="0" step="0.1" />
          <span class="time-display" id="time-display">0:00 / 0:00</span>
        </div>
      </div>

      <div class="dashboard-main">

        <!-- Footfall Card -->
        <div class="kpi-card fade-in">
          <div class="kpi-header">
            <div class="kpi-title-wrap">
              <h2 class="kpi-title" style="color:#8B1010">Footfall</h2>
            </div>
            <span class="kpi-cam-badge">Footfall Camera</span>
          </div>
          <div class="kpi-body">
            <div class="kpi-video-container">
              <span class="kpi-video-label">CAM-01 · Footfall</span>
              <video id="vid-footfall" class="kpi-video" preload="metadata" playsinline></video>
            </div>
            <div class="kpi-right">
              <div class="kpi-metric-label">Total In Count</div>
              <div class="kpi-metric-value" id="kpi-ft" style="color:#8B1010">0</div>
              <div class="kpi-demo-badges">
                <span class="kpi-badge-item" id="kpi-ft-m"><span class="badge-dot" style="background:#3B82F6"></span>M: 0 (0%)</span>
                <span class="kpi-badge-item" id="kpi-ft-f"><span class="badge-dot" style="background:#EC4899"></span>F: 0 (0%)</span>
                <span class="kpi-badge-item" id="kpi-ft-c"><span class="badge-dot" style="background:#F59E0B"></span>C: 0 (0%)</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Billing Card -->
        <div class="kpi-card fade-in" style="animation-delay:.1s">
          <div class="kpi-header">
            <div class="kpi-title-wrap">
              <h2 class="kpi-title" style="color:#059669">Billing Counter</h2>
            </div>
            <span class="kpi-cam-badge" style="background:rgba(5,150,105,.1);color:#059669;border-color:rgba(5,150,105,.3)">Billing Camera</span>
          </div>
          <div class="kpi-body">
            <div class="kpi-video-container">
              <span class="kpi-video-label">CAM-02 · Billing</span>
              <video id="vid-billing" class="kpi-video" preload="metadata" playsinline></video>
            </div>
            <div class="kpi-right">
              <div class="kpi-metric-label">Customers at Register</div>
              <div class="kpi-metric-value" id="kpi-bill-cust" style="color:#059669">0</div>
              <div class="kpi-metric-label">Employee Time</div>
              <div class="kpi-time-value" id="kpi-bill-emp-time">00:00</div>
              <div class="kpi-metric-label">Interaction Time</div>
              <div class="kpi-time-value" id="kpi-bill-int-time">00:00</div>
              <div style="margin-top:14px;">
                <div id="kpi-bill-queue" class="queue-badge">Queue &lt; 2</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  // ── Wire videos ───────────────────────────────────────────────────────────
  const vidFootfall = document.getElementById('vid-footfall');
  const vidBilling  = document.getElementById('vid-billing');
  vidFootfall.src = videos.footfall;
  vidBilling.src  = videos.billing;

  const master  = vidFootfall;
  const slaves  = [vidBilling];
  const allVids = [master, ...slaves];

  // ── Controls ──────────────────────────────────────────────────────────────
  const seekBar     = document.getElementById('seek-bar');
  const timeDisplay = document.getElementById('time-display');
  let isSeeking     = false;
  let duration      = 0;
  let playbackSpeed = 1;

  function updateSeekFill(pctVal) {
    const p = Math.max(0, Math.min(100, pctVal));
    seekBar.style.background = `linear-gradient(to right, #8B1010 ${p}%, #cbd5e1 ${p}%)`;
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

  // ── DOM helpers ───────────────────────────────────────────────────────────
  function setTxt(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = typeof val === 'number' ? val.toLocaleString() : val;
  }

  // ── syncToFrame ───────────────────────────────────────────────────────────
  function syncToFrame(t) {
    // Footfall
    const ftRow = findRow(data.footfall, t);
    let fm = 0, ff = 0, fc = 0;
    if (ftRow) [fm, ff, fc] = ftRow.in;
    const ftTotal = fm + ff + fc;
    setTxt('kpi-ft',   ftTotal);
    setTxt('kpi-ft-m', `M: ${fm} (${pctOf(fm, ftTotal)}%)`);
    setTxt('kpi-ft-f', `F: ${ff} (${pctOf(ff, ftTotal)}%)`);
    setTxt('kpi-ft-c', `C: ${fc} (${pctOf(fc, ftTotal)}%)`);

    // Billing
    const billRow = findRow(data.billing, t);
    if (billRow) {
      setTxt('kpi-bill-cust',     billRow.customerCount);
      setTxt('kpi-bill-emp-time', fmtMmSs(billRow.employeeTimeSecs));
      setTxt('kpi-bill-int-time', fmtMmSs(billRow.interactionTimeSecs));
      const q = queueColor(billRow.customerCount);
      const qEl = document.getElementById('kpi-bill-queue');
      if (qEl) { qEl.textContent = q.label; qEl.style.background = q.color; }
    }
  }

  syncToFrame(0);

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
    liveFrame.style.display     = 'block';
    dashHeader.style.background = 'transparent';
    dashHeader.style.boxShadow  = 'none';
    dashHeader.style.pointerEvents = 'none';
    dashHeader.querySelector('.header-right').style.pointerEvents = 'auto';
    headerTitle.style.visibility   = 'hidden';
    headerXrBlock.style.visibility = 'hidden';
    btnLive.classList.add('active');
    btnPoc.classList.remove('active');
    allVids.forEach(v => v.pause());
  });

  btnPoc.addEventListener('click', () => {
    liveFrame.style.display     = 'none';
    pocBody.style.display       = '';
    dashHeader.style.background = '';
    dashHeader.style.boxShadow  = '';
    dashHeader.style.pointerEvents = '';
    dashHeader.querySelector('.header-right').style.pointerEvents = '';
    headerTitle.style.visibility   = '';
    headerXrBlock.style.visibility = '';
    btnPoc.classList.add('active');
    btnLive.classList.remove('active');
  });
}
