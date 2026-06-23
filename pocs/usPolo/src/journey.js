function fmtRelTime(sec) {
  const m = Math.floor(sec / 60);
  const s = String(Math.floor(sec % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

function fmtDwell(sec) {
  if (!sec || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const CAM_LABELS = {
  cam1: 'CAM 1 — Entrance',
  cam2: 'CAM 2 — Stairs to 1st Floor',
  cam5: 'CAM 5 — Trial & Billing',
};

function showImageModal(imgUrl, zoneLabel) {
  document.querySelector('.frame-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'frame-overlay';
  const modal = document.createElement('div');
  modal.className = 'frame-modal';
  modal.innerHTML = `
    <div class="frame-header">
      <div class="frame-meta">
        <span class="frame-zone-label">${zoneLabel}</span>
      </div>
      <button class="frame-close">✕</button>
    </div>`;
  const img = document.createElement('img');
  img.src = imgUrl;
  img.className = 'frame-video';
  img.style.cssText = 'width:100%;display:block;';
  modal.appendChild(img);
  overlay.appendChild(modal);
  const close = () => overlay.remove();
  modal.querySelector('.frame-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  });
  document.body.appendChild(overlay);
}

function showFrameModal(videoSrc, videoTs, zoneLabel, camera, offset = -2) {
  document.querySelector('.frame-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'frame-overlay';

  const modal = document.createElement('div');
  modal.className = 'frame-modal';
  modal.innerHTML = `
    <div class="frame-header">
      <div class="frame-meta">
        <span class="frame-zone-label">${zoneLabel}</span>
        <span class="frame-cam-label">${CAM_LABELS[camera] || camera}</span>
      </div>
      <button class="frame-close">✕</button>
    </div>
    <div class="frame-seeking">Seeking to timestamp…</div>`;

  const vid = document.createElement('video');
  vid.src = videoSrc;
  vid.muted = true;
  vid.playsInline = true;
  vid.preload = 'metadata';
  vid.className = 'frame-video';
  vid.style.display = 'none';
  modal.appendChild(vid);
  overlay.appendChild(modal);

  const seekTs = Math.max(0, videoTs + offset);
  vid.addEventListener('loadedmetadata', () => { vid.currentTime = seekTs; });
  vid.addEventListener('seeked', () => {
    vid.pause();
    modal.querySelector('.frame-seeking').style.display = 'none';
    vid.style.display = 'block';
  }, { once: true });

  const close = () => { vid.pause(); vid.src = ''; overlay.remove(); };
  modal.querySelector('.frame-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  });

  document.body.appendChild(overlay);
}

export function renderSpotlightJourney(container, spotlightJourney, assetUrls) {
  if (!spotlightJourney || spotlightJourney.steps.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>Journey data not available.</p>
      <p class="empty-sub">Add zone_events.csv to enable journey tracking.</p></div>`;
    return;
  }

  const { gid, steps, totalTime } = spotlightJourney;

  const stepsHtml = steps.map((step, i) => {
    const isLast = i === steps.length - 1;
    const exitRow = step.exitT !== null ? `
      <div class="spot-event-row">
        <span class="spot-evt-badge exit">↑ Left</span>
        <span class="spot-evt-time">${fmtRelTime(step.exitT)}</span>
        <button class="eye-btn"
          data-ts="${step.exitVideoTs}"
          data-offset="2"
          data-camera="${step.camera}"
          data-label="${step.label} — Exit"
          title="View camera at exit moment">&#128065;</button>
      </div>` : '';
    return `
      <div class="spot-step" style="--step-delay:${i * 120}ms">
        <div class="spot-dot-wrap">
          <div class="spot-dot" style="background:${step.color};box-shadow:0 0 0 4px ${step.color}28"></div>
          ${!isLast ? `<div class="spot-line"></div>` : ''}
        </div>
        <div class="spot-info">
          <div class="spot-zone" style="color:${step.color}">${step.label}
            ${step.dwellS ? `<span class="spot-dwell-inline">${fmtDwell(step.dwellS)}</span>` : ''}
          </div>
          <div class="spot-event-pair">
            <div class="spot-event-row">
              <span class="spot-evt-badge entry">↓ Entered</span>
              <span class="spot-evt-time">${fmtRelTime(step.entryT)}</span>
              <button class="eye-btn"
                data-ts="${step.videoTs}"
                data-offset="${step.entryOffset ?? -2}"
                data-camera="${step.camera}"
                data-label="${step.label} — Entry"
                ${step.staticEntryImage ? `data-static-img="${step.staticEntryImage}"` : ''}
                title="View camera at entry moment">&#128065;</button>
            </div>
            ${exitRow}
          </div>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="spotlight-wrap">
      <div class="spotlight-header">
        <span class="spotlight-tag">Customer ID #${gid}</span>
        <span class="spotlight-total">Total: <strong>${fmtDwell(totalTime)}</strong> in store</span>
      </div>
      <div class="spotlight-timeline">
        ${stepsHtml}
      </div>
      <div class="spotlight-footer">
        AI-tracked individual journey &nbsp;·&nbsp; ${steps.length} zones visited
      </div>
    </div>`;

  container.querySelectorAll('.eye-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.staticImg) {
        showImageModal(btn.dataset.staticImg, btn.dataset.label);
        return;
      }
      const src = assetUrls[btn.dataset.camera];
      if (!src) return;
      showFrameModal(src, Number(btn.dataset.ts), btn.dataset.label, btn.dataset.camera, Number(btn.dataset.offset ?? -2));
    });
  });
}
