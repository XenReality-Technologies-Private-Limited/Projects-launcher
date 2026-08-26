function fmtSecs(s) {
  const t = Math.round(s || 0);
  const m = Math.floor(t / 60);
  const sec = t % 60;
  return `${m}m ${sec.toString().padStart(2, '0')}s`;
}

// Find last row where timeSeconds <= t (binary search on sparse data)
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

export function renderDashboard(appEl, { kitchenVideoUrl, billingVideoUrl }, { kitchenRows }, { billingRows, waitingRows, avgBillingTime }) {
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
        <div class="header-live-pill"><span class="live-dot"></span>Live</div>
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

      <!-- Left: Kitchen PPE -->
      <div class="panel">
        <div class="video-header"><span class="video-label">Kitchen — PPE Detection</span></div>
        <video id="kitchen-video" src="${kitchenVideoUrl}" controls muted playsinline autoplay class="panel-video"></video>
        <div class="kpi-row">
          <div class="kpi-tile kpi-tile--green">
            <div class="kpi-label">Gloves On</div>
            <div class="kpi-value" id="gloves-on">—</div>
          </div>
          <div class="kpi-tile kpi-tile--red">
            <div class="kpi-label">Gloves Off</div>
            <div class="kpi-value" id="gloves-off">—</div>
          </div>
          <div class="kpi-tile kpi-tile--green">
            <div class="kpi-label">Hairnet On</div>
            <div class="kpi-value" id="hairnet-on">—</div>
          </div>
          <div class="kpi-tile kpi-tile--red">
            <div class="kpi-label">Hairnet Off</div>
            <div class="kpi-value" id="hairnet-off">—</div>
          </div>
        </div>
      </div>

      <!-- Right: Billing / Waiting -->
      <div class="panel">
        <div class="video-header"><span class="video-label">Billing &amp; Waiting Area</span></div>
        <video id="billing-video" src="${billingVideoUrl}" controls muted playsinline autoplay class="panel-video"></video>
        <div class="kpi-row">
          <div class="kpi-tile kpi-tile--navy">
            <div class="kpi-label">Billing Queue</div>
            <div class="kpi-value" id="billing-queue">—</div>
          </div>
          <div class="kpi-tile kpi-tile--purple">
            <div class="kpi-label">Avg Billing Time</div>
            <div class="kpi-value kpi-value--sm" id="avg-billing">${fmtSecs(avgBillingTime)}</div>
          </div>
          <div class="kpi-tile kpi-tile--amber">
            <div class="kpi-label">Waiting for Food</div>
            <div class="kpi-value" id="waiting-count">—</div>
          </div>
        </div>
      </div>

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

  const kitchenVideo  = appEl.querySelector('#kitchen-video');
  const billingVideo  = appEl.querySelector('#billing-video');

  const elGlovesOn    = appEl.querySelector('#gloves-on');
  const elGlovesOff   = appEl.querySelector('#gloves-off');
  const elHairnetOn   = appEl.querySelector('#hairnet-on');
  const elHairnetOff  = appEl.querySelector('#hairnet-off');
  const elBillingQ    = appEl.querySelector('#billing-queue');
  const elAvgBilling  = appEl.querySelector('#avg-billing');
  const elWaiting     = appEl.querySelector('#waiting-count');

  // Kitchen video sync
  function updateKitchen() {
    const row = findRow(kitchenRows, kitchenVideo.currentTime);
    if (!row) return;
    elGlovesOn.textContent   = row.gloves_on;
    elGlovesOff.textContent  = row.gloves_off;
    elHairnetOn.textContent  = row.hairnet_on;
    elHairnetOff.textContent = row.hairnet_off;

    // Highlight if violation
    appEl.querySelector('.kpi-tile--red:nth-of-type(2)').classList.toggle('kpi-tile--alert', row.gloves_off > 0);
    appEl.querySelector('.kpi-tile--red:last-of-type').classList.toggle('kpi-tile--alert', row.hairnet_off > 0);
  }

  kitchenVideo.addEventListener('timeupdate', updateKitchen);
  kitchenVideo.addEventListener('seeked', updateKitchen);

  // Billing / waiting video sync
  function updateBilling() {
    const t = billingVideo.currentTime;
    const bRow = findRow(billingRows, t);
    const wRow = findRow(waitingRows, t);
    if (bRow) elBillingQ.textContent = bRow.billing_count;
    if (wRow) elWaiting.textContent  = wRow.waiting_count;
    // Avg billing time is pre-calculated and static
    elAvgBilling.textContent = fmtSecs(avgBillingTime);
  }

  billingVideo.addEventListener('timeupdate', updateBilling);
  billingVideo.addEventListener('seeked', updateBilling);
}
