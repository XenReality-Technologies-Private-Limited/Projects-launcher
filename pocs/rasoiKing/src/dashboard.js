import { tinRows } from './tin-data.js';

function findRow(rows, t) {
  if (!rows.length) return null;
  let lo = 0, hi = rows.length - 1, result = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].timeSeconds <= t) { result = rows[mid]; lo = mid + 1; }
    else hi = mid - 1;
  }
  return result;
}

// The customer gave these directly (not derived from tinRows): loading
// starts at the first can and is confirmed stopped a bit after the last
// one logged, rather than assuming it ends exactly at the final can.
const LOADING_START_SEC = 7 * 60 + 27;
const LOADING_STOP_SEC  = 36 * 60 + 46;

const TRUCK_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"/><path d="M14 17H9"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`;
const CAN_ICON   = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7" width="16" height="13" rx="1.5"/><path d="M8 7V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/></svg>`;

export function renderDashboard(appEl, { videoUrl }, { truckRows }) {
  appEl.innerHTML = `
    <header class="dash-header">
      <div class="header-xr-block">
        <div class="header-logo-pill"><img src="https://d108xxen99ni2a.cloudfront.net/XenRealitylogo.webp" alt="XenReality" /></div><div class="header-vdivider"></div>
      </div>
      <div class="header-title">XenTrack Demo Dashboard</div>
      <div class="header-right">
        <div class="header-datetime">
          <span class="header-date" id="hdr-date"></span>
          <span class="header-time" id="hdr-time"></span>
        </div>
        <div class="header-live-pill"><span class="live-dot"></span>Live</div>
        <img class="header-customer-logo" src="https://d2uimaqek2eby3.cloudfront.net/Rasoi/Rasoi_King_Logo.webp" alt="Rasoi King" onerror="this.style.display='none'" />
        <button class="header-signout" title="Sign out" onclick="(function(){try{localStorage.removeItem('pocketbase_auth');}catch(e){}window.location.reload();})()"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>
      </div>
    </header>

    <div class="content">
      <section class="rasoi-main">
        <div class="video-card">
          <div class="video-header"><span class="video-label">Camera 01 — Loading Bay</span></div>
          <div class="video-body">
            <video id="loading-video" src="${videoUrl}" controls muted playsinline autoplay class="panel-video"></video>
          </div>
        </div>

        <div class="rasoi-sidebar">
          <div class="status-cards">
            <div class="status-card">
              <div class="status-card-head">
                <span class="status-card-title"><span class="status-icon">${TRUCK_ICON}</span><span class="status-card-label">Truck Status</span></span>
              </div>
              <div class="status-value" id="truck-status">
                <span class="status-dot" id="truck-status-dot"></span>
                <span id="truck-status-text">—</span>
              </div>
              <p class="status-sub" id="truck-status-sub">Waiting for video to start</p>
            </div>

            <div class="status-card">
              <div class="status-card-head">
                <span class="status-card-title"><span class="status-icon">${CAN_ICON}</span><span class="status-card-label">Oil Cans Loaded</span></span>
                <span class="status-pill status-pill--pending" id="loading-pill">Not Started</span>
              </div>
              <div class="status-value">
                <span class="status-big" id="cans-loaded">0</span>
                <span class="status-unit">cans</span>
              </div>
              <p class="status-sub">Running total from the loading bay footage</p>
            </div>
          </div>

          <div class="activity-card">
            <div class="activity-head">
              <span>Recent Activity</span>
            </div>
            <ul class="activity-list" id="activity-list">
              <li class="activity-empty">No activity yet</li>
            </ul>
          </div>
        </div>
      </section>
    </div>`;

  // Clock
  const hdrDate = appEl.querySelector('#hdr-date');
  const hdrTime = appEl.querySelector('#hdr-time');
  function tickClock() {
    const now = new Date();
    const tz  = { timeZone: 'Asia/Kolkata' };
    if (hdrDate) hdrDate.textContent = now.toLocaleDateString('en-GB', { ...tz, day: '2-digit', month: 'short', year: 'numeric' });
    if (hdrTime) hdrTime.textContent = now.toLocaleTimeString('en-GB', { ...tz, hour: '2-digit', minute: '2-digit' });
  }
  tickClock();
  setInterval(tickClock, 1000);

  const video        = appEl.querySelector('#loading-video');
  const statusDot    = appEl.querySelector('#truck-status-dot');
  const statusText   = appEl.querySelector('#truck-status-text');
  const statusSub    = appEl.querySelector('#truck-status-sub');
  const cansLoadedEl = appEl.querySelector('#cans-loaded');
  const loadingPill  = appEl.querySelector('#loading-pill');
  const activityList = appEl.querySelector('#activity-list');

  // Every activity entry shows a wall-clock-looking time, even the can
  // events — those only have a video_time, so it's looked up against
  // truck_presence (sampled every second across the whole clip) instead.
  function wallTimeAt(t) {
    const row = findRow(truckRows, t);
    return row?.wallTime || '--:--:--';
  }

  function logActivity(text, dotClass, t) {
    const empty = activityList.querySelector('.activity-empty');
    if (empty) empty.remove();
    const li = document.createElement('li');
    li.className = 'activity-item';
    li.innerHTML = `<span class="activity-dot ${dotClass}"></span><span class="activity-time">${wallTimeAt(t)}</span><span class="activity-text">${text}</span>`;
    activityList.insertBefore(li, activityList.firstChild);
    // Keep the feed from growing without bound over a long clip.
    while (activityList.children.length > 30) {
      activityList.removeChild(activityList.lastChild);
    }
  }

  let lastPresent = null;

  function updateTruckStatus() {
    const t   = video.currentTime;
    const row = findRow(truckRows, t);
    if (!row) return;

    const present = row.present === 1;
    statusText.textContent = present ? 'Present' : 'Absent';
    statusDot.classList.toggle('status-dot--on', present);
    statusDot.classList.toggle('status-dot--off', !present);
    statusSub.textContent = present
      ? 'Delivery truck detected at loading bay'
      : 'No truck currently at the loading bay';

    if (lastPresent !== null && row.present !== lastPresent) {
      logActivity(
        present ? 'Truck detected at loading bay' : 'Truck departed',
        present ? 'activity-dot--on' : 'activity-dot--off',
        t
      );
    }
    lastPresent = row.present;
  }

  // Tracks how far into tinRows we've already logged, so fast-forwarding
  // (or just timeupdate firing again before the next can) doesn't re-log
  // the same can twice. Entries are replayed in order if the playhead jumps
  // past more than one at once (e.g. a seek).
  let loggedTinIndex = -1;

  function updateCans() {
    const t = video.currentTime;
    const row = findRow(tinRows, t);
    cansLoadedEl.textContent = row ? row.cumulative : 0;

    const currentIndex = row ? tinRows.indexOf(row) : -1;
    if (currentIndex > loggedTinIndex) {
      for (let i = loggedTinIndex + 1; i <= currentIndex; i++) {
        logActivity('Oil can loaded', 'activity-dot--can', tinRows[i].timeSeconds);
      }
    }
    loggedTinIndex = currentIndex;
  }

  let lastLoadingState = null; // 'pending' | 'active' | 'done'

  function updateLoadingState() {
    const t = video.currentTime;
    const state = t < LOADING_START_SEC ? 'pending'
      : t < LOADING_STOP_SEC ? 'active'
      : 'done';

    if (state !== lastLoadingState) {
      loadingPill.className = `status-pill status-pill--${state}`;
      loadingPill.textContent = state === 'pending' ? 'Not Started'
        : state === 'active' ? 'Loading In Progress'
        : 'Loading Complete';

      if (lastLoadingState !== null) {
        logActivity(
          state === 'active' ? 'Loading started' : 'Loading complete',
          state === 'active' ? 'activity-dot--can' : 'activity-dot--on',
          t
        );
      }
      lastLoadingState = state;
    }
  }

  function updateAll() {
    updateTruckStatus();
    updateCans();
    updateLoadingState();
  }

  video.addEventListener('timeupdate', updateAll);
  video.addEventListener('seeked', updateAll);
  video.addEventListener('loadedmetadata', updateAll);
}
