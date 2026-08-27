function fmtSecs(s) {
  const t = Math.round(s || 0);
  const m = Math.floor(t / 60);
  const sec = t % 60;
  return `${m}m ${sec.toString().padStart(2, '0')}s`;
}

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

export function renderDashboard(appEl, { kitchenVideoUrl, billingVideoUrl }, { kitchenRows }, { billingRows, waitingRows, billingEvents }) {
  appEl.innerHTML = `
    <header class="dash-header">
      <div class="header-xr-block">
        <div class="header-logo-pill"><img src="https://d108xxen99ni2a.cloudfront.net/XenRealitylogo.webp" alt="XenReality" /></div><div class="header-vdivider"></div>
      </div>
      <div class="header-title">PoC Dashboard</div>
      <div class="header-right">
        <div class="header-datetime">
          <span class="header-date" id="hdr-date"></span>
          <span class="header-time" id="hdr-time"></span>
        </div>
        <div class="header-live-pill"><span class="live-dot"></span>Live</div>
        <button class="header-signout" title="Sign out" onclick="(function(){try{localStorage.removeItem('pocketbase_auth');}catch(e){}window.location.reload();})()"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>
      </div>
    </header>

    <div class="content">

      <!-- Both feeds, side by side -->
      <section class="videos">
        <div class="video-card">
          <div class="video-header"><span class="video-label">Kitchen — PPE Compliance</span></div>
          <div class="video-body">
            <video id="kitchen-video" src="${kitchenVideoUrl}" controls muted playsinline autoplay class="panel-video"></video>
          </div>
        </div>
        <div class="video-card">
          <div class="video-header"><span class="video-label">Billing &amp; Waiting Area</span></div>
          <div class="video-body">
            <video id="billing-video" src="${billingVideoUrl}" controls muted playsinline autoplay class="panel-video"></video>
          </div>
        </div>
      </section>

      <!-- Every metric, in one row underneath -->
      <section class="metrics">
        <div class="metric-group">
          <div class="metric-group-head">
            <span class="metric-group-title">Kitchen — PPE</span>
          </div>
          <div class="metric-tiles">
            <div class="tile tile--green">
              <div class="tile-label">Gloves ON</div>
              <div class="tile-value" id="gloves-on">—</div>
            </div>
            <div class="tile tile--red">
              <div class="tile-label">Gloves OFF</div>
              <div class="tile-value" id="gloves-off">—</div>
            </div>
            <div class="tile tile--green">
              <div class="tile-label">Hairnet ON</div>
              <div class="tile-value" id="hairnet-on">—</div>
            </div>
            <div class="tile tile--red">
              <div class="tile-label">Hairnet OFF</div>
              <div class="tile-value" id="hairnet-off">—</div>
            </div>
          </div>
        </div>

        <div class="metric-group">
          <div class="metric-group-head">
            <span class="metric-group-title">Billing &amp; Waiting</span>
          </div>
          <div class="metric-tiles">
            <div class="tile">
              <div class="tile-label">Billing Queue</div>
              <div class="tile-value" id="billing-queue">—</div>
            </div>
            <div class="tile">
              <div class="tile-label">Avg Billing Time</div>
              <div class="tile-value tile-value--sm" id="avg-billing">—</div>
            </div>
            <div class="tile">
              <div class="tile-label">Waiting for Food</div>
              <div class="tile-value" id="waiting-count">—</div>
            </div>
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

  const kitchenVideo = appEl.querySelector('#kitchen-video');
  const billingVideo = appEl.querySelector('#billing-video');

  const elGlovesOn    = appEl.querySelector('#gloves-on');
  const elGlovesOff   = appEl.querySelector('#gloves-off');
  const elHairnetOn   = appEl.querySelector('#hairnet-on');
  const elHairnetOff  = appEl.querySelector('#hairnet-off');

  const elBillingQ   = appEl.querySelector('#billing-queue');
  const elAvgBilling = appEl.querySelector('#avg-billing');
  const elWaiting    = appEl.querySelector('#waiting-count');

  function updateKitchen() {
    const row = findRow(kitchenRows, kitchenVideo.currentTime);
    if (!row) return;
    elGlovesOn.textContent   = row.gloves_on;
    elGlovesOff.textContent  = row.gloves_off;
    elHairnetOn.textContent  = row.hairnet_on;
    elHairnetOff.textContent = row.hairnet_off;
  }

  kitchenVideo.addEventListener('timeupdate', updateKitchen);
  kitchenVideo.addEventListener('seeked', updateKitchen);

  function updateBilling() {
    const t    = billingVideo.currentTime;
    const bRow = findRow(billingRows, t);
    const wRow = findRow(waitingRows, t);
    if (bRow) elBillingQ.textContent = bRow.billing_count;
    if (wRow) elWaiting.textContent   = wRow.waiting_count;
    // Running average: past events if any, else fall back to session-wide average
    const pastEvents  = billingEvents.filter(e => e.timeSeconds <= t);
    const eventsToAvg = pastEvents.length > 0 ? pastEvents : billingEvents;
    if (eventsToAvg.length) {
      const avg = eventsToAvg.reduce((s, e) => s + e.duration, 0) / eventsToAvg.length;
      elAvgBilling.textContent = fmtSecs(avg);
    }
  }

  billingVideo.addEventListener('timeupdate', updateBilling);
  billingVideo.addEventListener('seeked', updateBilling);
}
