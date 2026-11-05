import initSqlJs from 'sql.js';

// ── Config: the Hilite Mall cross-camera re-identification feed ──────────
// A second, unrelated detection type from the same mall (person re-id
// across floors) that gets appended after the 4 parking incident cards.
const CF = 'https://d2uimaqek2eby3.cloudfront.net/Hilite-Mall';
const DB_URL = `${CF}/persons.db`;

const VIDEO_CONFIG = {
  ch20: {
    url: `${CF}/ch20.mp4`,
    // Camera embedded timestamp at frame 0 (use this, not NVR filename time)
    startTime: '2026-04-24T15:37:22',
    label: 'Ground Lobby — CAM ch20',
    suppressReId: true, // RE-ID only confirmed after cross-camera match; mirror ch25 here
  },
  ch25: {
    url: `${CF}/ch25.mp4`,
    startTime: '2026-04-24T15:41:09',
    label: '-5 — CAM ch25',
    // Show a ticking clock from ch20's start until this camera's feed begins
    clockStartTime: '2026-04-24T15:37:22',
  },
};

const CHANNEL_LABELS = { ch20: 'Ground Lobby', ch25: '-5' };

const SCREENSHOT_V = '2';
const TRANSITION_SCREENSHOTS = {
  '4_ch20': {
    departed: `${CF}/screenshots/p4_departed_ground_lobby.webp?v=${SCREENSHOT_V}`,
    arrived: `${CF}/screenshots/p4_arrived_ipc.webp?v=${SCREENSHOT_V}`,
  },
};

// ── SQLite (sql.js) loading ────────────────────────────────────────────
async function createDatabase() {
  const SQL = await initSqlJs({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/sql.js@1.14.0/dist/${file}`,
  });
  const response = await fetch(`${DB_URL}?v=${Date.now()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch persons.db: ${response.status} ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  return new SQL.Database(new Uint8Array(buffer));
}

function loadFloorVisits(db) {
  const stmt = db.prepare('SELECT * FROM floor_visits ORDER BY entry_time ASC');
  const rows = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    rows.push({
      id: r.id,
      canonical_id: r.canonical_id,
      channel: r.channel,
      entry_time: r.entry_time,
      exit_time: r.exit_time,
      duration_seconds: Number(r.duration_seconds) || 0,
    });
  }
  stmt.free();
  return rows;
}

function loadPersons(db) {
  const stmt = db.prepare('SELECT * FROM persons ORDER BY canonical_id ASC');
  const rows = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    rows.push({
      canonical_id: r.canonical_id,
      matched_ids: (() => { try { return JSON.parse(r.matched_ids || '[]'); } catch { return []; } })(),
      floors_visited: Number(r.floors_visited) || 0,
    });
  }
  stmt.free();
  return rows;
}

function loadTransitions(db) {
  const stmt = db.prepare('SELECT * FROM transitions ORDER BY exit_time ASC');
  const rows = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    rows.push({
      id: r.id,
      canonical_id: r.canonical_id,
      from_channel: r.from_channel,
      to_channel: r.to_channel,
      exit_time: r.exit_time,
      entry_time: r.entry_time,
      travel_seconds: Number(r.travel_seconds) || 0,
    });
  }
  stmt.free();
  return rows;
}

async function initDatabase() {
  const db = await createDatabase();
  return {
    floorVisits: loadFloorVisits(db),
    persons: loadPersons(db),
    transitions: loadTransitions(db),
  };
}

// Builds per-channel time series indexed by integer seconds from video start.
// Returns: { [channel]: { counts: number[], personIds: Array<number[]> } }
function buildTimeSeries(floorVisits, videoConfig) {
  const series = {};
  for (const [channel, cfg] of Object.entries(videoConfig)) {
    const videoStart = new Date(cfg.startTime).getTime();
    const visits = floorVisits.filter((v) => v.channel === channel);

    let maxSec = 60;
    for (const v of visits) {
      const exitOffset = (new Date(v.exit_time).getTime() - videoStart) / 1000;
      if (exitOffset > maxSec) maxSec = exitOffset;
    }
    maxSec = Math.ceil(maxSec) + 5;

    const counts = new Array(maxSec).fill(0);
    const personIds = Array.from({ length: maxSec }, () => []);

    for (const v of visits) {
      const entryOffset = (new Date(v.entry_time).getTime() - videoStart) / 1000;
      const exitOffset = (new Date(v.exit_time).getTime() - videoStart) / 1000;
      const start = Math.max(0, Math.floor(entryOffset));
      const end = Math.min(maxSec - 1, Math.floor(exitOffset));
      for (let s = start; s <= end; s++) {
        counts[s]++;
        personIds[s].push(v.canonical_id);
      }
    }
    series[channel] = { counts, personIds };
  }
  return series;
}

// Renders a 60-second sliding window of numeric data on a canvas, with a
// playhead at the right edge that matches the current video time (in seconds).
class TimeSeriesGraph {
  constructor(canvas, { lineColor = '#2563eb', playheadColor = '#6b7280', yMax = 1, showLiveCount = false, isBinary = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.values = [];
    this.currentIndex = 0;
    this.yMax = yMax;
    this.lineColor = lineColor;
    this.playheadColor = playheadColor;
    this.showLiveCount = showLiveCount;
    this.isBinary = isBinary;
  }

  setValues(values) { this.values = Array.isArray(values) ? values : []; }
  setCurrentIndex(index) { this.currentIndex = typeof index === 'number' && index >= 0 ? index : 0; }

  render() {
    const { canvas, ctx } = this;
    if (!canvas || !ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    if (!this.values || this.values.length === 0 || this.yMax <= 0) return;

    const end = this.currentIndex;
    const start = Math.max(0, end - 59);
    const windowValues = this.values.slice(start, end + 1);
    if (windowValues.length === 0) return;

    const paddingLeft = this.isBinary ? 62 : 8;
    const paddingRight = this.showLiveCount ? 24 : 8;
    const paddingTop = 12;
    const paddingBottom = 12;
    const innerWidth = width - paddingLeft - paddingRight;
    const innerHeight = height - paddingTop - paddingBottom;
    const maxIndex = windowValues.length - 1;
    const playheadX = width - paddingRight;

    ctx.save();

    if (this.isBinary) {
      const matchY = paddingTop;
      const noMatchY = height - paddingBottom;
      ctx.fillStyle = '#9ca3af';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('MATCH', paddingLeft - 6, matchY);
      ctx.textBaseline = 'bottom';
      ctx.fillText('NO MATCH', paddingLeft - 6, noMatchY);

      ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, paddingTop);
      ctx.lineTo(width - paddingRight, paddingTop);
      ctx.stroke();
      ctx.setLineDash([]);

      if (maxIndex > 0) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.13)';
        let segStart = null;
        for (let i = 0; i <= maxIndex; i++) {
          const present = (windowValues[i] || 0) > 0;
          if (present && segStart === null) segStart = i;
          if (!present && segStart !== null) {
            const x1 = paddingLeft + (segStart / maxIndex) * innerWidth;
            const x2 = paddingLeft + (i / maxIndex) * innerWidth;
            ctx.fillRect(x1, paddingTop, x2 - x1, innerHeight);
            segStart = null;
          }
        }
        if (segStart !== null) {
          const x1 = paddingLeft + (segStart / maxIndex) * innerWidth;
          ctx.fillRect(x1, paddingTop, innerWidth - (x1 - paddingLeft), innerHeight);
        }
      }
    }

    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, height - paddingBottom);
    ctx.lineTo(width - paddingRight, height - paddingBottom);
    ctx.stroke();

    ctx.strokeStyle = this.lineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let prevY = paddingTop + innerHeight;
    let lastY = paddingTop + innerHeight;
    windowValues.forEach((value, i) => {
      const clamped = Math.max(0, Math.min(this.yMax, value || 0));
      const x = paddingLeft + (maxIndex === 0 ? innerWidth / 2 : (i / maxIndex) * innerWidth);
      const y = paddingTop + innerHeight - (clamped / this.yMax) * innerHeight;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else if (this.isBinary) {
        ctx.lineTo(x, prevY);
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      prevY = y;
      lastY = y;
    });
    ctx.stroke();

    if (this.showLiveCount && windowValues.length > 0) {
      const liveCount = windowValues[windowValues.length - 1];
      ctx.fillStyle = this.lineColor;
      ctx.font = '16px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(liveCount), playheadX + 4, lastY);
    }

    ctx.strokeStyle = this.playheadColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(playheadX, paddingTop);
    ctx.lineTo(playheadX, height - paddingBottom);
    ctx.stroke();

    ctx.restore();
  }
}

// ── Icons ──────────────────────────────────────────────────────────────
const CAMERA_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><circle cx="12" cy="14" r="2"/></svg>`;
const JOURNEY_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M13 6l6 6-6 6"/></svg>`;
const EYE_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const PLAY_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
const MUTE_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
const FULLSCREEN_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
const CROSSFLOOR_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
const CLOCK_ICON_BLUE = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
const CLOCK_ICON_PURPLE = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

// ── Formatting helpers ─────────────────────────────────────────────────
function formatIST(ms) {
  return new Date(ms).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function fmtWaitDuration(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function fmtTimeIST(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function fmtTravel(seconds) {
  if (seconds == null) return '--';
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
}
function fmtDwellDuration(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '--';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}
function totalDwell(floorVisits, channel) {
  const visits = floorVisits.filter((v) => v.channel === channel);
  if (!visits.length) return null;
  return visits.reduce((sum, v) => sum + v.duration_seconds, 0);
}

// ── Markup ─────────────────────────────────────────────────────────────
function cameraCardHtml(channel, cfg) {
  const hasWait = Boolean(cfg.clockStartTime);
  return `
    <section class="kpi-card camera-card" id="reid-card-${channel}">
      <div class="kpi-header">
        <div class="kpi-title-wrap">
          <span class="kpi-title-icon" aria-hidden="true">${CAMERA_ICON}</span>
          <h2 class="kpi-title">${cfg.label}</h2>
        </div>
        <span class="kpi-badge">ACTIVE</span>
      </div>
      <div class="kpi-video-container">
        <span class="kpi-video-label">${channel.toUpperCase()}</span>
        ${hasWait ? `
        <div class="camera-wait-screen" id="reid-wait-${channel}">
          <div class="camera-wait-osd" id="reid-wait-osd-${channel}"></div>
          <div class="camera-wait-status">Awaiting camera feed&hellip;</div>
          <div class="camera-wait-controls">
            <span class="wait-ctrl-btn" aria-label="playing">${PLAY_ICON}</span>
            <span class="wait-ctrl-time" id="reid-wait-time-${channel}"></span>
            <div class="wait-ctrl-track" id="reid-wait-track-${channel}">
              <div class="wait-ctrl-fill" id="reid-wait-fill-${channel}"></div>
              <div class="wait-ctrl-thumb" id="reid-wait-thumb-${channel}"></div>
            </div>
            <span class="wait-ctrl-btn" aria-label="muted">${MUTE_ICON}</span>
            <span class="wait-ctrl-btn" aria-label="fullscreen">${FULLSCREEN_ICON}</span>
          </div>
        </div>` : ''}
        <video class="kpi-video" id="reid-video-${channel}" src="${cfg.url}" controls muted playsinline style="${hasWait ? 'display:none' : ''}"></video>
      </div>
      <div class="camera-metrics">
        <div class="camera-count-block">
          <div class="kpi-metric-label">RE-ID MATCH</div>
          <div id="reid-badges-${channel}"></div>
          <div class="kpi-legend reid-sublabel" id="reid-sub-${channel}"></div>
        </div>
        <div class="camera-graph-block">
          <canvas class="kpi-graph" id="reid-graph-${channel}" width="600" height="120"></canvas>
          <div class="kpi-legend">Re-ID match activity — last 60 s &nbsp;|&nbsp; green fill = person on floor</div>
        </div>
      </div>
    </section>`;
}

function journeyTableHtml(transitions) {
  if (!transitions.length) {
    return `
      <section class="kpi-card journey-card">
        <div class="kpi-header">
          <div class="kpi-title-wrap">
            <span class="kpi-title-icon" aria-hidden="true">${JOURNEY_ICON}</span>
            <h2 class="kpi-title">Person Journeys</h2>
          </div>
          <span class="kpi-badge journey-count">0 TRACKED</span>
        </div>
        <p class="journey-empty">No cross-floor journeys detected.</p>
      </section>`;
  }

  const rows = transitions.map((t) => {
    const shots = TRANSITION_SCREENSHOTS[`${t.canonical_id}_${t.from_channel}`];
    const departedEye = shots?.departed
      ? `<button type="button" class="eye-btn" data-snapshot="${shots.departed}" data-title="P#${t.canonical_id} — ${CHANNEL_LABELS[t.from_channel] ?? t.from_channel} · ${fmtTimeIST(t.exit_time)}" title="View snapshot">${EYE_ICON}</button>`
      : '';
    const arrivedEye = shots?.arrived
      ? `<button type="button" class="eye-btn" data-snapshot="${shots.arrived}" data-title="P#${t.canonical_id} — ${CHANNEL_LABELS[t.to_channel] ?? t.to_channel} · ${fmtTimeIST(t.entry_time)}" title="View snapshot">${EYE_ICON}</button>`
      : '';
    return `
      <tr>
        <td class="journey-person-id">P#${t.canonical_id}</td>
        <td>${CHANNEL_LABELS[t.from_channel] ?? t.from_channel}</td>
        <td>${CHANNEL_LABELS[t.to_channel] ?? t.to_channel}</td>
        <td class="journey-time">${fmtTimeIST(t.exit_time)}${departedEye}</td>
        <td class="journey-time">${fmtTimeIST(t.entry_time)}${arrivedEye}</td>
        <td class="journey-travel">${fmtTravel(t.travel_seconds)}</td>
      </tr>`;
  }).join('');

  return `
    <section class="kpi-card journey-card">
      <div class="kpi-header">
        <div class="kpi-title-wrap">
          <span class="kpi-title-icon" aria-hidden="true">${JOURNEY_ICON}</span>
          <h2 class="kpi-title">Person Journeys</h2>
        </div>
        <span class="kpi-badge journey-count">${transitions.length} TRACKED</span>
      </div>
      <div class="journey-table-wrap">
        <table class="journey-table">
          <thead>
            <tr><th>Person</th><th>From</th><th>To</th><th>Departed</th><th>Arrived</th><th>Travel Time</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
    <div class="snapshot-backdrop" id="reid-snapshot-backdrop" style="display:none">
      <div class="snapshot-modal">
        <div class="snapshot-header">
          <span class="snapshot-title" id="reid-snapshot-title"></span>
          <button type="button" class="snapshot-close" id="reid-snapshot-close">&times;</button>
        </div>
        <img class="snapshot-img" id="reid-snapshot-img" src="" alt="" />
      </div>
    </div>`;
}

function statsRowHtml(persons, floorVisits) {
  const crossFloor = persons.filter((p) => p.floors_visited > 1).length;
  const dwellCh20 = totalDwell(floorVisits, 'ch20');
  const dwellCh25 = totalDwell(floorVisits, 'ch25');
  return `
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon" aria-hidden="true">${CROSSFLOOR_ICON}</div>
        <div class="stat-label">Cross-Floor Persons</div>
        <div class="stat-value">${crossFloor}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" aria-hidden="true">${CLOCK_ICON_BLUE}</div>
        <div class="stat-label">Total Dwell — Ground Lobby</div>
        <div class="stat-value">${fmtDwellDuration(dwellCh20)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" aria-hidden="true">${CLOCK_ICON_PURPLE}</div>
        <div class="stat-label">Total Dwell — -5</div>
        <div class="stat-value">${fmtDwellDuration(dwellCh25)}</div>
      </div>
    </div>`;
}

// ── Behavior ───────────────────────────────────────────────────────────
function setupCameraCard(mainEl, channel, cfg, series, { getForcedIds, onMatchChange, onPhaseChange } = {}) {
  const hasWait = Boolean(cfg.clockStartTime);
  const video = mainEl.querySelector(`#reid-video-${channel}`);
  const waitScreen = mainEl.querySelector(`#reid-wait-${channel}`);
  const badgesEl = mainEl.querySelector(`#reid-badges-${channel}`);
  const subEl = mainEl.querySelector(`#reid-sub-${channel}`);
  const canvas = mainEl.querySelector(`#reid-graph-${channel}`);

  const counts = series.counts ?? [];
  const personIds = series.personIds ?? [];
  const yMax = Math.max(1, ...(counts.length ? counts : [1]));
  const graph = new TimeSeriesGraph(canvas, { lineColor: '#10b981', yMax, isBinary: true, showLiveCount: false });
  graph.setValues(counts);
  graph.setCurrentIndex(0);
  graph.render();

  let phase = hasWait ? 'wait' : 'main';
  let currentSec = 0;

  function renderBadgesAndSub() {
    const activeIds = getForcedIds ? getForcedIds() : (phase === 'main' ? (personIds[currentSec] ?? []) : []);
    const isAwaiting = getForcedIds ? activeIds.length === 0 : phase === 'wait';
    badgesEl.innerHTML = activeIds.length
      ? `<div class="reid-ids">${activeIds.map((id) => `<span class="reid-id-badge">P#${id}</span>`).join('')}</div>`
      : `<div class="kpi-metric-value reid-absent">--</div>`;
    subEl.textContent = activeIds.length > 0
      ? 'Cross-camera match on floor'
      : isAwaiting ? 'Tracking — awaiting cross-camera match' : 'No match in frame';
    onMatchChange?.(activeIds);
  }

  function updateGraph() {
    graph.setCurrentIndex(phase === 'main' ? currentSec : 0);
    graph.render();
  }

  video.addEventListener('timeupdate', () => {
    currentSec = Math.floor(video.currentTime);
    updateGraph();
    renderBadgesAndSub();
  });

  if (hasWait) {
    const clockStartMs = new Date(cfg.clockStartTime).getTime();
    const waitEndMs = new Date(cfg.startTime).getTime();
    let clockMs = clockStartMs;

    const osdEl = mainEl.querySelector(`#reid-wait-osd-${channel}`);
    const timeEl = mainEl.querySelector(`#reid-wait-time-${channel}`);
    const fillEl = mainEl.querySelector(`#reid-wait-fill-${channel}`);
    const thumbEl = mainEl.querySelector(`#reid-wait-thumb-${channel}`);
    const trackEl = mainEl.querySelector(`#reid-wait-track-${channel}`);

    function renderWait() {
      const totalSec = (waitEndMs - clockStartMs) / 1000;
      const elapsedSec = (clockMs - clockStartMs) / 1000;
      const pct = totalSec > 0 ? Math.min(100, (elapsedSec / totalSec) * 100) : 0;
      osdEl.textContent = `24-04-2026 ${formatIST(clockMs)}`;
      timeEl.textContent = `${fmtWaitDuration(elapsedSec)} / ${fmtWaitDuration(totalSec)}`;
      fillEl.style.width = `${pct}%`;
      thumbEl.style.left = `${pct}%`;
    }

    function enterMainPhase() {
      phase = 'main';
      waitScreen.style.display = 'none';
      video.style.display = '';
      video.play().catch(() => {});
      onPhaseChange?.('main');
      renderBadgesAndSub();
      updateGraph();
    }

    renderWait();
    const waitTimer = setInterval(() => {
      clockMs = Math.min(waitEndMs, clockMs + 1000);
      renderWait();
      if (clockMs >= waitEndMs) {
        clearInterval(waitTimer);
        enterMainPhase();
      }
    }, 1000);

    trackEl.addEventListener('click', (e) => {
      const rect = trackEl.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      clockMs = clockStartMs + pct * (waitEndMs - clockStartMs);
      renderWait();
    });

    onPhaseChange?.('wait');
  } else {
    video.play().catch(() => {});
  }

  renderBadgesAndSub();
  updateGraph();

  return { renderBadgesAndSub };
}

function setupJourneyModal(mainEl) {
  const backdrop = mainEl.querySelector('#reid-snapshot-backdrop');
  if (!backdrop) return;
  const img = mainEl.querySelector('#reid-snapshot-img');
  const title = mainEl.querySelector('#reid-snapshot-title');

  function open(src, t) {
    img.src = src;
    img.alt = t;
    title.textContent = t;
    backdrop.style.display = 'flex';
  }
  function close() {
    backdrop.style.display = 'none';
    img.src = '';
  }

  mainEl.addEventListener('click', (e) => {
    const eyeBtn = e.target.closest('.eye-btn');
    if (eyeBtn) { open(eyeBtn.dataset.snapshot, eyeBtn.dataset.title); return; }
    if (e.target.closest('#reid-snapshot-close') || e.target === backdrop) close();
  });
}

function mountReidSection(mainEl, dbData, timeSeries) {
  const channels = Object.entries(VIDEO_CONFIG);
  const mirrorChannel = channels.find(([, cfg]) => cfg.clockStartTime)?.[0] ?? null;

  const cardsHtml = channels.map(([channel, cfg]) => cameraCardHtml(channel, cfg)).join('');
  mainEl.insertAdjacentHTML('beforeend', `<div class="camera-grid">${cardsHtml}</div>`);
  mainEl.insertAdjacentHTML('beforeend', journeyTableHtml(dbData.transitions));
  mainEl.insertAdjacentHTML('beforeend', statsRowHtml(dbData.persons, dbData.floorVisits));

  const state = { mirrorIds: [] };
  const controllers = {};

  for (const [channel, cfg] of channels) {
    const isForced = Boolean(cfg.suppressReId) && mirrorChannel && mirrorChannel !== channel;
    const isMirrorSource = channel === mirrorChannel;
    controllers[channel] = setupCameraCard(mainEl, channel, cfg, timeSeries[channel] || { counts: [], personIds: [] }, {
      getForcedIds: isForced ? () => state.mirrorIds : null,
      onMatchChange: isMirrorSource
        ? (ids) => {
            state.mirrorIds = ids;
            for (const [ch, c] of channels) {
              if (ch !== channel && c.suppressReId) controllers[ch]?.renderBadgesAndSub();
            }
          }
        : null,
      onPhaseChange: isMirrorSource
        ? (phase) => {
            if (phase !== 'wait') return;
            state.mirrorIds = [];
            for (const [ch, c] of channels) {
              if (ch !== channel && c.suppressReId) controllers[ch]?.renderBadgesAndSub();
            }
          }
        : null,
    });
  }

  setupJourneyModal(mainEl);
}

export async function renderReidSection(mainEl) {
  const placeholderId = 'reid-status-msg';
  mainEl.insertAdjacentHTML('beforeend', `<div id="${placeholderId}" class="reid-loading">Loading Hilite Mall re-id data&hellip;</div>`);
  const placeholder = mainEl.querySelector(`#${placeholderId}`);
  try {
    const dbData = await initDatabase();
    const timeSeries = buildTimeSeries(dbData.floorVisits, VIDEO_CONFIG);
    placeholder.remove();
    mountReidSection(mainEl, dbData, timeSeries);
  } catch (err) {
    placeholder.textContent = `Failed to load Hilite Mall re-id data: ${err?.message || err}`;
  }
}
