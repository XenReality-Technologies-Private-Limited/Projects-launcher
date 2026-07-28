const ICON_TOTAL = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="9" cy="7" r="2"/><path d="M3 22v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
  <circle cx="17" cy="7" r="2"/><path d="M13 22v-2a4 4 0 0 1 4-4h2"/>
</svg>`;

const ICON_NEW = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
  <circle cx="9" cy="7" r="4"/>
  <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
</svg>`;

const ICON_RETURNING = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="1 4 1 10 7 10"/>
  <path d="M3.51 15a9 9 0 1 0 .49-4"/>
</svg>`;

function fmtTime(s) {
  const t = Math.round(s || 0);
  return `${Math.floor(t / 60).toString().padStart(2, '0')}:${(t % 60).toString().padStart(2, '0')}`;
}

export function renderDashboard(appEl, { videoUrl, logoUrl }, { events, firstSeenMap }) {
  appEl.innerHTML = `
    <header class="dash-header">
      <div class="header-xr-block">
        <div class="header-logo-pill">
          <img src="https://d108xxen99ni2a.cloudfront.net/XenRealitylogo.webp" alt="XenReality" />
        </div>
        <div class="header-vdivider"></div>
      </div>
      <div class="header-title">PoC Dashboard</div>
      <div class="header-right">
        <div class="header-datetime">
          <span class="header-date" id="hdr-date"></span>
          <span class="header-time" id="hdr-time"></span>
        </div>
        <div class="header-live-pill"><span class="live-dot live-dot--green"></span>Live</div>
        <img class="header-customer-logo" src="${logoUrl}" alt="Goyal Sons" onerror="this.style.display='none'" />
        <button class="header-signout" title="Sign out"
          onclick="(function(){try{localStorage.removeItem('pocketbase_auth');}catch(e){}window.location.reload();})()">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </header>

    <div class="content-grid">
      <div class="video-section">
        <video id="main-video" src="${videoUrl}" controls muted playsinline autoplay></video>
        <div class="video-footer">
          <span class="video-label">Annotated Face Recognition Feed</span>
        </div>
      </div>
      <div class="right-column">
        <div class="kpi-stack">
          <div class="kpi-tile kpi-tile--full" style="--kpi-color:#2E3192">
            <div class="kpi-tile-value" id="kpi-total">0</div>
            <div class="kpi-tile-label">Total Customers</div>
          </div>
          <div class="kpi-row-pair">
            <div class="kpi-tile" style="--kpi-color:#10b981">
              <div class="kpi-tile-value" id="kpi-new">0</div>
              <div class="kpi-tile-label">New Customers</div>
            </div>
            <div class="kpi-tile" style="--kpi-color:#f59e0b">
              <div class="kpi-tile-value" id="kpi-returning">0</div>
              <div class="kpi-tile-label">Returning Customers</div>
            </div>
          </div>
        </div>
        <div class="feed-section">
          <div class="feed-header">
            <span class="feed-title">Customer Events</span>
            <span class="feed-count" id="feed-count">0 events</span>
          </div>
          <div class="feed-list" id="feed-list">
            <div class="feed-empty">Play the video to see customer events</div>
          </div>
        </div>
      </div>
    </div>`;

  // Clock
  const hdrDate = appEl.querySelector('#hdr-date');
  const hdrTime = appEl.querySelector('#hdr-time');
  function tickClock() {
    const now = new Date();
    const tz = { timeZone: 'Asia/Dubai' };
    if (hdrDate) hdrDate.textContent = now.toLocaleDateString('en-GB', { ...tz, day: '2-digit', month: 'short', year: 'numeric' });
    if (hdrTime) hdrTime.textContent = now.toLocaleTimeString('en-GB', { ...tz, hour: '2-digit', minute: '2-digit' });
  }
  tickClock();
  setInterval(tickClock, 1000);

  const video      = appEl.querySelector('#main-video');
  const kpiTotal   = appEl.querySelector('#kpi-total');
  const kpiNew     = appEl.querySelector('#kpi-new');
  const kpiRet     = appEl.querySelector('#kpi-returning');
  const feedList   = appEl.querySelector('#feed-list');
  const feedCount  = appEl.querySelector('#feed-count');

  let lastIdx = -1;

  function update() {
    const t = video.currentTime;

    // Binary search for events up to t
    let lo = 0, hi = events.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (events[mid].time <= t) lo = mid + 1;
      else hi = mid;
    }
    const upTo = lo;
    if (upTo === lastIdx) return;
    lastIdx = upTo;

    // KPI counts
    const seenNew = new Set();
    const seenRet = new Set();
    for (let i = 0; i < upTo; i++) {
      const e = events[i];
      if (e.is_returning === 0) seenNew.add(e.person_id);
      else                      seenRet.add(e.person_id);
    }
    kpiTotal.textContent = seenNew.size + seenRet.size;
    kpiNew.textContent   = seenNew.size;
    kpiRet.textContent   = seenRet.size;
    feedCount.textContent = `${upTo} event${upTo !== 1 ? 's' : ''}`;

    // Render feed (newest at top)
    if (upTo === 0) {
      feedList.innerHTML = '<div class="feed-empty">Play the video to see customer events</div>';
      return;
    }

    let html = '';
    for (let i = upTo - 1; i >= 0; i--) {
      const e = events[i];
      if (e.is_returning === 0) {
        html += `
          <div class="feed-group">
            <div class="feed-row feed-row--new">
              <button class="feed-time" data-seek="${e.time}">${fmtTime(e.time)}</button>
              <div class="feed-info">
                <span class="feed-customer">Customer #${e.person_id}</span>
                <span class="feed-badge feed-badge--new">First Visit</span>
              </div>
            </div>
          </div>`;
      } else {
        const fs = firstSeenMap.get(e.person_id);
        const subRow = fs !== undefined ? `
            <div class="feed-row feed-row--sub">
              <button class="feed-time" data-seek="${fs}">${fmtTime(fs)}</button>
              <div class="feed-info">
                <span class="feed-sub-text">First seen at ${fmtTime(fs)}</span>
              </div>
            </div>` : '';
        html += `
          <div class="feed-group feed-group--returning">
            <div class="feed-row">
              <button class="feed-time" data-seek="${e.time}">${fmtTime(e.time)}</button>
              <div class="feed-info">
                <span class="feed-customer">Customer #${e.person_id}</span>
                <span class="feed-badge feed-badge--returning">Returning</span>
              </div>
            </div>${subRow}
          </div>`;
      }
    }
    feedList.innerHTML = html;
  }

  video.addEventListener('timeupdate', update);
  video.addEventListener('loadedmetadata', update);
  video.addEventListener('seeked', update);

  feedList.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-seek]');
    if (btn) video.currentTime = parseFloat(btn.dataset.seek);
  });
}
