const CAR_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14M5 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm14 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM3 17V9l2-5h14l2 5v8"/><path d="M7 9h10"/></svg>`;

function fmtClipTime(s) {
  const t = Math.max(0, Math.round(s || 0));
  const m = Math.floor(t / 60);
  const sec = t % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// Each clip's `source` string embeds the camera recording's actual start
// timestamp as a 14-digit YYYYMMDDHHMMSS run (format/position varies per
// camera — e.g. "..._20260213195233_195312" vs "D19_20250927182300"), which
// is clip time 0. Built using Date.UTC and read back with the UTC getters so
// the displayed clock matches the camera's stamp regardless of the viewer's
// own timezone.
function parseSourceEpoch(source) {
  const m = /(?<!\d)(\d{14})(?!\d)/.exec(source || '');
  if (!m) return null;
  const s = m[1];
  return Date.UTC(
    +s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8),
    +s.slice(8, 10), +s.slice(10, 12), +s.slice(12, 14)
  );
}

function fmtWallClock(sourceEpoch, clipSeconds) {
  if (sourceEpoch == null) return fmtClipTime(clipSeconds);
  const d = new Date(sourceEpoch + clipSeconds * 1000);
  const hh = d.getUTCHours().toString().padStart(2, '0');
  const mm = d.getUTCMinutes().toString().padStart(2, '0');
  const ss = d.getUTCSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

const CLOCK_ICON  = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`;
const PERSON_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1"/></svg>`;
const WARN_ICON   = `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 1 21h22L12 2zm0 6.5a1 1 0 0 1 1 1V14a1 1 0 1 1-2 0V9.5a1 1 0 0 1 1-1zM12 17a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5z"/></svg>`;
const CHECK_ICON  = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m8.5 12.5 2.5 2.5 5-5"/></svg>`;

// object-fit:contain letterboxes/pillarboxes the native frame inside the
// container — car_box coordinates are in native video pixels, so the
// highlight box has to be placed within that letterboxed inner rect, not
// the container's own bounds, or it drifts whenever the aspect ratios
// don't match (they don't: these clips are 1280x784, the panel is 16:9).
// The detection pipeline sometimes fires two overlapping-time events (different
// `slot`/`car_box`) for the same physical car — not two separate vehicles.
// Collapse any events whose time windows overlap into a single incident,
// unioning their boxes into one highlight rect.
function mergeAlerts(events) {
  const sorted = [...events].sort((a, b) => a.start - b.start);
  const merged = [];
  for (const ev of sorted) {
    const last = merged[merged.length - 1];
    if (last && ev.start <= last.end) {
      last.end = Math.max(last.end, ev.end);
      last.dwell_s = Math.max(last.dwell_s, ev.dwell_s);
      const [x1, y1, x2, y2] = ev.car_box;
      last.box = [
        Math.min(last.box[0], x1), Math.min(last.box[1], y1),
        Math.max(last.box[2], x2), Math.max(last.box[3], y2),
      ];
    } else {
      merged.push({ start: ev.start, end: ev.end, dwell_s: ev.dwell_s, box: [...ev.car_box] });
    }
  }
  return merged;
}

// The card first appears the moment playback reaches ev.start, before the
// incident has finished — showing its end time or final dwell duration right
// away would be displaying info nobody could actually know yet. Reveal both
// only once playback reaches the incident's own end; until then, show it as
// still in progress. Once reported, the card keeps showing (see `reported`
// in draw()) even after playback moves past ev.end.
function incidentCardHtml(ev, sourceEpoch, t, clipId) {
  const ended = t >= ev.end - 0.05;
  const endLabel = ended ? fmtWallClock(sourceEpoch, ev.end) : 'Ongoing…';
  const dwellLabel = ended
    ? `${Math.round(ev.dwell_s)} seconds`
    : `${Math.round(Math.max(0, t - ev.start))} seconds so far…`;

  return `
    <div class="incident-card">
      <div class="incident-banner">
        <span class="incident-banner-icon">${WARN_ICON}</span>
        <span class="incident-banner-text">Suspicious Activity Detected</span>
      </div>
      <div class="incident-row">
        <span class="incident-icon">${CLOCK_ICON}</span>
        <div class="incident-row-body">
          <div class="incident-row-label">Detection Time</div>
          <button type="button" class="incident-row-value incident-row-value--clickable" data-clip="${clipId}" data-seek="${ev.start}" title="Jump to this point in the video">${fmtWallClock(sourceEpoch, ev.start)} &ndash; ${endLabel}</button>
        </div>
      </div>
      <div class="incident-divider"></div>
      <div class="incident-row">
        <span class="incident-icon">${PERSON_ICON}</span>
        <div class="incident-row-body">
          <div class="incident-row-label">Time spent near the Car</div>
          <div class="incident-row-value incident-row-value--lg">${dwellLabel}</div>
        </div>
      </div>
    </div>`;
}

function noAlertCardHtml() {
  return `
    <div class="incident-card incident-card--ok">
      <div class="incident-banner incident-banner--ok">
        <span class="incident-banner-icon">${CHECK_ICON}</span>
        <span class="incident-banner-text">No Suspicious Activity</span>
      </div>
    </div>`;
}

function videoContentRect(video, container) {
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 784;
  const containerAspect = cw / ch;
  const videoAspect = vw / vh;
  let renderedW, renderedH, offsetX, offsetY;
  if (containerAspect > videoAspect) {
    renderedH = ch;
    renderedW = ch * videoAspect;
    offsetX = (cw - renderedW) / 2;
    offsetY = 0;
  } else {
    renderedW = cw;
    renderedH = cw / videoAspect;
    offsetX = 0;
    offsetY = (ch - renderedH) / 2;
  }
  return { offsetX, offsetY, scaleX: renderedW / vw, scaleY: renderedH / vh };
}

export function renderDashboard(appEl, clips) {
  const cardsHtml = clips.map((clip) => {
    return `
      <section class="kpi-card" id="card-${clip.id}">
        <div class="kpi-header">
          <div class="kpi-title-wrap">
            <span class="kpi-title-icon" aria-hidden="true">${CAR_ICON}</span>
            <h2 class="kpi-title">${clip.label}</h2>
          </div>
        </div>
        <div class="kpi-body">
          <div class="kpi-video-container">
            <span class="kpi-video-label">${clip.label.toUpperCase()}</span>
            <video class="kpi-video" id="video-${clip.id}" src="${clip.video}" controls muted playsinline autoplay></video>
            <div class="kpi-overlay" id="overlay-${clip.id}"></div>
          </div>
          <div class="kpi-right">
            <div class="kpi-metric-label">Alert Status</div>
            <div class="alert-panel" id="alerts-${clip.id}">${noAlertCardHtml()}</div>
          </div>
        </div>
      </section>`;
  }).join('');

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
        <img class="header-customer-logo" src="https://d2uimaqek2eby3.cloudfront.net/Hilite-Mall/hilite-mall-logo.svg" alt="Hilite Mall" onerror="this.style.display='none'" />
        <button class="header-signout" title="Sign out" onclick="(function(){try{localStorage.removeItem('pocketbase_auth');}catch(e){}window.location.reload();})()"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>
      </div>
    </header>

    <main class="dashboard-main">${cardsHtml}</main>`;

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

  // Clicking (or Enter/Space on) an incident's Detection Time seeks that
  // clip's own video to the start of the incident.
  function seekFromTarget(target) {
    const el = target.closest('[data-seek]');
    if (!el) return;
    const video = appEl.querySelector(`#video-${el.dataset.clip}`);
    if (video) video.currentTime = parseFloat(el.dataset.seek);
  }
  appEl.addEventListener('click', (e) => seekFromTarget(e.target));
  appEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!e.target.closest('[data-seek]')) return;
    e.preventDefault();
    seekFromTarget(e.target);
  });

  // Per-clip: keep the car-highlight overlay and the alert panel in sync
  // with playback — the alert card appears once the incident starts and
  // stays visible (see `reported` in draw()) even after it ends.
  for (const clip of clips) {
    const video      = appEl.querySelector(`#video-${clip.id}`);
    const overlay    = appEl.querySelector(`#overlay-${clip.id}`);
    const container  = overlay.parentElement;
    const alertPanel = appEl.querySelector(`#alerts-${clip.id}`);
    const incidents  = mergeAlerts((clip.data.events || []).filter((e) => e.alert));
    const sourceEpoch = parseSourceEpoch(clip.data.source);

    function draw() {
      const t = video.currentTime;
      // The highlight box only makes sense while the incident is actually
      // happening on screen, but once an incident has been reported it
      // should stay reported — the card shouldn't flip back to "no alert"
      // just because playback moved past the incident's end (e.g. the clip
      // finished).
      const onScreen = incidents.filter((ev) => t >= ev.start && t <= ev.end);
      const reported = incidents.filter((ev) => t >= ev.start);

      if (alertPanel) {
        alertPanel.innerHTML = reported.length
          ? reported.map((ev) => incidentCardHtml(ev, sourceEpoch, t, clip.id)).join('')
          : noAlertCardHtml();
      }

      if (!onScreen.length) { overlay.innerHTML = ''; return; }
      const rect = videoContentRect(video, container);
      overlay.innerHTML = onScreen.map((ev) => {
        const [x1, y1, x2, y2] = ev.box;
        const left = rect.offsetX + x1 * rect.scaleX;
        const top  = rect.offsetY + y1 * rect.scaleY;
        const w    = (x2 - x1) * rect.scaleX;
        const h    = (y2 - y1) * rect.scaleY;
        return `<div class="car-highlight" style="left:${left}px;top:${top}px;width:${w}px;height:${h}px;"></div>`;
      }).join('');
    }

    video.addEventListener('timeupdate', draw);
    video.addEventListener('seeked', draw);
    video.addEventListener('loadedmetadata', draw);
    window.addEventListener('resize', draw);
  }
}
