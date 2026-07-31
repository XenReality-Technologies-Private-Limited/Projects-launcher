
// Person IDs whose "returning" events should be suppressed (show first-visit only)
const SUPPRESS_RETURNING = new Set([276, 243, 77, 92]);

// Person IDs whose "first visit" events should be suppressed entirely
const SUPPRESS_NEW = new Set([12, 14, 16, 17, 18, 314, 312]);

const EYE_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
  <circle cx="12" cy="12" r="3"/>
</svg>`;

function fmtTime(s) {
  const t = Math.round(s || 0);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
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
        <div class="video-header">
          <span class="video-label">Annotated Face Recognition Feed</span>
        </div>
        <video id="main-video" src="${videoUrl}" controls muted playsinline autoplay></video>
      </div>
      <div class="right-column">
        <div class="kpi-stack">
          <div class="kpi-tile" style="--kpi-color:#2E3192">
            <div class="kpi-tile-value" id="kpi-total">0</div>
            <div class="kpi-tile-label">Total Customers</div>
          </div>
          <div class="kpi-tile" style="--kpi-color:#10b981">
            <div class="kpi-tile-value" id="kpi-new">0</div>
            <div class="kpi-tile-label">New Customers</div>
          </div>
          <div class="kpi-tile" style="--kpi-color:#f59e0b">
            <div class="kpi-tile-value" id="kpi-returning">0</div>
            <div class="kpi-tile-label">Returning Customers</div>
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
    </div>

    <div class="face-modal" id="face-modal">
      <div class="face-modal-backdrop" id="face-modal-backdrop"></div>
      <div class="face-modal-box">
        <button class="face-modal-close" id="face-modal-close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <img class="face-modal-img" id="face-modal-img" src="" alt="Face screenshot" />
      </div>
    </div>`;

  // Clock
  const hdrDate = appEl.querySelector('#hdr-date');
  const hdrTime = appEl.querySelector('#hdr-time');
  function tickClock() {
    const now = new Date();
    const tz = { timeZone: 'Asia/Kolkata' };
    if (hdrDate) hdrDate.textContent = now.toLocaleDateString('en-GB', { ...tz, day: '2-digit', month: 'short', year: 'numeric' });
    if (hdrTime) hdrTime.textContent = now.toLocaleTimeString('en-GB', { ...tz, hour: '2-digit', minute: '2-digit' });
  }
  tickClock();
  setInterval(tickClock, 1000);

  const video     = appEl.querySelector('#main-video');
  const kpiTotal  = appEl.querySelector('#kpi-total');
  const kpiNew    = appEl.querySelector('#kpi-new');
  const kpiRet    = appEl.querySelector('#kpi-returning');
  const feedList  = appEl.querySelector('#feed-list');
  const feedCount = appEl.querySelector('#feed-count');
  const faceModal = appEl.querySelector('#face-modal');
  const faceImg   = appEl.querySelector('#face-modal-img');

  // Build image lookup: "person_id_returning" → data URL
  const imageMap = new Map();
  for (const e of events) {
    if (e.image) imageMap.set(`${e.person_id}_${e.returning}`, e.image);
  }

  function openFace(src) {
    faceImg.src = src;
    faceModal.classList.add('open');
  }
  function closeFace() {
    faceModal.classList.remove('open');
    faceImg.src = '';
  }

  appEl.querySelector('#face-modal-backdrop').addEventListener('click', closeFace);
  appEl.querySelector('#face-modal-close').addEventListener('click', closeFace);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeFace(); });

  let lastIdx = -1;

  function update() {
    const t = video.currentTime;

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
      if (e.returning === 0 && !SUPPRESS_NEW.has(e.person_id)) seenNew.add(e.person_id);
      else if (e.returning === 1 && !SUPPRESS_RETURNING.has(e.person_id)) seenRet.add(e.person_id);
    }
    kpiTotal.textContent  = seenNew.size + seenRet.size;
    kpiNew.textContent    = seenNew.size;
    kpiRet.textContent    = seenRet.size;
    feedCount.textContent = `${upTo} event${upTo !== 1 ? 's' : ''}`;

    if (upTo === 0) {
      feedList.innerHTML = '<div class="feed-empty">Play the video to see customer events</div>';
      return;
    }

    let html = '';
    for (let i = upTo - 1; i >= 0; i--) {
      const e = events[i];
      if (e.returning === 1 && SUPPRESS_RETURNING.has(e.person_id)) continue;
      if (e.returning === 0 && SUPPRESS_NEW.has(e.person_id)) continue;
      const hasImg    = imageMap.has(`${e.person_id}_${e.returning}`);
      const eyeBtn    = hasImg ? `<button class="feed-eye" data-key="${e.person_id}_${e.returning}" title="View face">${EYE_ICON}</button>` : '';

      if (e.returning === 0) {
        html += `
          <div class="feed-group" data-seek="${e.time}">
            <div class="feed-row">
              <button class="feed-time">${fmtTime(e.time)}</button>
              <div class="feed-info">
                <span class="feed-customer">Person #${e.person_id}</span>
                <span class="feed-badge feed-badge--new">First Visit</span>
              </div>
              ${eyeBtn}
            </div>
          </div>`;
      } else {
        const fs          = firstSeenMap.get(e.person_id);
        const hasSubImg   = imageMap.has(`${e.person_id}_0`);
        const subEyeBtn   = hasSubImg ? `<button class="feed-eye" data-key="${e.person_id}_0" title="View face">${EYE_ICON}</button>` : '';
        const subRow = fs !== undefined ? `
            <div class="feed-row feed-row--sub" data-seek="${fs}">
              <button class="feed-time">${fmtTime(fs)}</button>
              <div class="feed-info">
                <span class="feed-sub-text">First seen at ${fmtTime(fs)}</span>
              </div>
              ${subEyeBtn}
            </div>` : '';
        html += `
          <div class="feed-group feed-group--returning" data-seek="${e.time}">
            <div class="feed-row">
              <button class="feed-time">${fmtTime(e.time)}</button>
              <div class="feed-info">
                <span class="feed-customer">Person #${e.person_id}</span>
                <span class="feed-badge feed-badge--returning">Returning</span>
              </div>
              ${eyeBtn}
            </div>${subRow}
          </div>`;
      }
    }
    feedList.innerHTML = html;
  }

  video.addEventListener('timeupdate', update);
  video.addEventListener('loadedmetadata', update);
  video.addEventListener('seeked', update);

  feedList.addEventListener('click', function (ev) {
    // Eye icon — show face image, don't seek
    const eyeBtn = ev.target.closest('.feed-eye');
    if (eyeBtn) {
      const img = imageMap.get(eyeBtn.dataset.key);
      if (img) openFace(img);
      return;
    }
    // Row click — seek video
    const group = ev.target.closest('[data-seek]');
    if (group) video.currentTime = parseFloat(group.dataset.seek);
  });
}
