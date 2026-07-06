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

function greetingsUnattended(t) {
  if (t >= 530) return 5;
  if (t >= 510) return 4;
  if (t >= 509) return 3;
  if (t >= 111) return 2;
  if (t >= 110) return 1;
  return 0;
}

function pctOf(n, total) {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

function pctBadges(mId, fId, cId) {
  return `
    <div class="kpi-demo">
      <span class="kpi-badge" id="${mId}"><span class="badge-dot" style="background:#3B82F6"></span>M: 0 (0%)</span>
      <span class="kpi-badge" id="${fId}"><span class="badge-dot" style="background:#EC4899"></span>F: 0 (0%)</span>
      <span class="kpi-badge" id="${cId}"><span class="badge-dot" style="background:#F59E0B"></span>C: 0 (0%)</span>
    </div>`;
}

function buildKpiCard({ id, label, sublabel, color, extraHtml = '' }) {
  return `
    <div class="kpi-card fade-in" style="--kpi-color:${color}">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value" id="${id}">0</div>
      ${sublabel ? `<div class="kpi-sub">${sublabel}</div>` : ''}
      ${extraHtml}
    </div>`;
}

export function renderDashboard(app, data, videos) {
  app.innerHTML = `
    <header class="dash-header">
      <div class="header-xr-block">
        <img src="https://d108xxen99ni2a.cloudfront.net/XenRealitylogo.webp" alt="XenReality" />
      </div>
      <div class="header-title">Thomsun - Yamaha Dashboard</div>
      <div class="header-right">
        <span id="ist-clock" style="font-size:13px;font-weight:600;color:#475569;font-family:monospace;padding-right:4px;"></span>
      </div>
    </header>

    <div class="dash-body">

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
            <div class="video-tile-label">Employee Interaction</div>
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

      <div class="kpi-section">
        <div class="section-label">Key Performance Indicators</div>
        <div class="kpi-grid kpi-grid-4">

          ${buildKpiCard({
            id: 'kpi-pb', label: 'Passerby', sublabel: 'Outside Store',
            color: '#003087',
            extraHtml: pctBadges('kpi-pb-m', 'kpi-pb-f', 'kpi-pb-c'),
          })}

          ${buildKpiCard({
            id: 'kpi-ft', label: 'Footfall', sublabel: 'In Count',
            color: '#E50000',
            extraHtml: pctBadges('kpi-ft-m', 'kpi-ft-f', 'kpi-ft-c'),
          })}

          ${buildKpiCard({
            id: 'kpi-greet', label: 'Greetings', sublabel: 'Unattended Customers',
            color: '#00A651',
            extraHtml: `
              <div class="kpi-demo">
                <span class="kpi-badge"><span class="badge-dot" style="background:#00A651"></span>Greeted: 0</span>
                <span class="kpi-badge"><span class="badge-dot" style="background:#EF4444"></span>Unattended: <span id="kpi-greet-un">0</span></span>
              </div>`,
          })}

          ${buildKpiCard({
            id: 'kpi-emp-count', label: 'Employee Interaction', sublabel: 'Live Stats',
            color: '#8B5CF6',
            extraHtml: `
              <div class="kpi-demo" style="flex-direction:column;gap:4px;margin-top:6px;">
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  <span class="kpi-badge"><span class="badge-dot" style="background:#3B82F6"></span>Employees: <span id="kpi-emp-cnt">0</span></span>
                  <span class="kpi-badge"><span class="badge-dot" style="background:#F59E0B"></span>Customers: <span id="kpi-cust-cnt">0</span></span>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  <span class="kpi-badge"><span class="badge-dot" style="background:#8B5CF6"></span>Emp Time: <span id="kpi-emp-time">00:00</span></span>
                  <span class="kpi-badge"><span class="badge-dot" style="background:#EC4899"></span>Interact: <span id="kpi-int-time">00:00</span></span>
                </div>
              </div>`,
          })}

        </div>
      </div>

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

  master.addEventListener('timeupdate', () => {
    const t = master.currentTime || 0;
    slaves.forEach(v => {
      if (!v.paused && Math.abs(v.currentTime - t) > SYNC_THRESHOLD) v.currentTime = t;
    });
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

  // ── IST clock ────────────────────────────────────────────────────────────
  function updateClock() {
    const now = new Date();
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const hh = String(ist.getHours()).padStart(2, '0');
    const mm = String(ist.getMinutes()).padStart(2, '0');
    const ss = String(ist.getSeconds()).padStart(2, '0');
    const el = document.getElementById('ist-clock');
    if (el) el.textContent = `IST ${hh}:${mm}:${ss}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  // ── syncToFrame ───────────────────────────────────────────────────────────
  function setTxt(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = typeof val === 'number' ? val.toLocaleString() : val;
  }

  function syncToFrame(t) {
    // Passerby
    const pbRow = findRow(data.passerby, t);
    if (pbRow) {
      const [pm, pf, pc] = pbRow.in;
      const ptotal = pm + pf + pc;
      setTxt('kpi-pb', ptotal);
      setTxt('kpi-pb-m', `M: ${pm} (${pctOf(pm, ptotal)}%)`);
      setTxt('kpi-pb-f', `F: ${pf} (${pctOf(pf, ptotal)}%)`);
      setTxt('kpi-pb-c', `C: ${pc} (${pctOf(pc, ptotal)}%)`);
    }

    // Footfall
    const ftRow = findRow(data.footfall, t);
    if (ftRow) {
      const [fm, ff, fc] = ftRow.in;
      const ftotal = fm + ff + fc;
      setTxt('kpi-ft', ftotal);
      setTxt('kpi-ft-m', `M: ${fm} (${pctOf(fm, ftotal)}%)`);
      setTxt('kpi-ft-f', `F: ${ff} (${pctOf(ff, ftotal)}%)`);
      setTxt('kpi-ft-c', `C: ${fc} (${pctOf(fc, ftotal)}%)`);
    }

    // Greetings (hardcoded step function, greeted always 0)
    const unattended = greetingsUnattended(t);
    setTxt('kpi-greet', unattended);
    setTxt('kpi-greet-un', unattended);

    // Employee Interaction
    const empRow = findRow(data.empInteractions, t);
    if (empRow) {
      setTxt('kpi-emp-count', empRow.employeeCount);
      setTxt('kpi-emp-cnt', empRow.employeeCount);
      setTxt('kpi-cust-cnt', empRow.customerCount);
      setTxt('kpi-emp-time', fmtMmSs(empRow.employeeTimeSecs));
      setTxt('kpi-int-time', fmtMmSs(empRow.interactionTimeSecs));
    }
  }

  syncToFrame(0);
}
