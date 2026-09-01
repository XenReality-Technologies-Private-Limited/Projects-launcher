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

export function renderDashboard(appEl, { kitchenVideoUrl, billingVideoUrl }, { kitchenRows }, { billingRows, serviceEvents }) {
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

          <!-- Headcount and its history. Kept on its own row rather than as a
               fifth tile: five columns squeezes "Hairnet OFF" into an ellipsis,
               and the chart needs the width anyway. -->
          <div class="emp-strip">
            <div class="emp-now">
              <div class="tile-label">Employees</div>
              <div class="tile-value" id="emp-count">—</div>
            </div>
            <div class="emp-chart">
              <canvas id="emp-canvas"></canvas>
            </div>
          </div>
        </div>

        <div class="metric-group">
          <div class="metric-group-head">
            <span class="metric-group-title">Billing</span>
          </div>
          <div class="metric-tiles">
            <div class="tile">
              <div class="tile-label">Billing Queue</div>
              <div class="tile-value" id="billing-queue">—</div>
            </div>
            <!-- Always in the layout. It reads "—" until the first transaction has
                 finished, then averages every transaction completed SO FAR, so the
                 figure only ever reflects what has actually happened by that point in
                 the clip. -->
            <div class="tile">
              <div class="tile-label">Avg Billing Time</div>
              <div class="tile-value tile-value--sm" id="avg-billing">—</div>
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
  const elEmpCount    = appEl.querySelector('#emp-count');
  const empCanvas     = appEl.querySelector('#emp-canvas');

  const elBillingQ   = appEl.querySelector('#billing-queue');
  const elAvgBilling = appEl.querySelector('#avg-billing');

  function updateKitchen() {
    const t   = kitchenVideo.currentTime;
    const row = findRow(kitchenRows, t);
    if (row) {
      elGlovesOn.textContent   = row.gloves_on;
      elGlovesOff.textContent  = row.gloves_off;
      elHairnetOn.textContent  = row.hairnet_on;
      elHairnetOff.textContent = row.hairnet_off;
      elEmpCount.textContent   = row.employees;
    }
    drawEmpChart(t);
  }

  kitchenVideo.addEventListener('timeupdate', updateKitchen);
  kitchenVideo.addEventListener('seeked', updateKitchen);
  kitchenVideo.addEventListener('loadedmetadata', updateKitchen);

  // ── Employee count over time ──────────────────────────────────────────────
  // Hand-drawn on a canvas: one small series, and the PoC has no charting
  // dependency to reuse.
  //
  // Only the portion up to the playhead is drawn at all. An earlier version
  // plotted the whole clip and dimmed the future, but a faded line is still a
  // visible line — the chart looked pre-drawn and gave away what was coming.
  // Nothing to the right of the playhead is rendered now, so it fills in as the
  // clip plays.
  //
  // Drawn as a STEP, not a smoothed line. A reading holds until the next one
  // arrives, so sloping between them would invent counts that were never
  // measured — and with values of 0 to 3, a diagonal reads as "1.5 employees".
  //
  // The x-axis spans the whole clip rather than scrolling, so it lines up with
  // the video scrubber underneath and scrubbing backwards behaves sensibly.
  function drawEmpChart(currentT) {
    if (!empCanvas || !kitchenRows.length) return;

    const cssW = empCanvas.clientWidth;
    const cssH = empCanvas.clientHeight;
    if (!cssW || !cssH) return;                 // laid out but not yet sized

    // Match the backing store to the device so lines stay crisp on HiDPI.
    const dpr = window.devicePixelRatio || 1;
    if (empCanvas.width !== Math.round(cssW * dpr) ||
        empCanvas.height !== Math.round(cssH * dpr)) {
      empCanvas.width  = Math.round(cssW * dpr);
      empCanvas.height = Math.round(cssH * dpr);
    }
    const ctx = empCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const padT = 5, padB = 3, padL = 1, padR = 1;
    const plotW = Math.max(1, cssW - padL - padR);
    const plotH = Math.max(1, cssH - padT - padB);

    const lastT = kitchenRows[kitchenRows.length - 1].timeSeconds || 1;
    const dur = Number.isFinite(kitchenVideo.duration) && kitchenVideo.duration > 0
      ? kitchenVideo.duration
      : lastT;
    const maxVal = Math.max(1, ...kitchenRows.map((r) => r.employees));

    const xOf = (t) => padL + Math.min(1, Math.max(0, t / dur)) * plotW;
    const yOf = (v) => padT + plotH - (v / maxVal) * plotH;

    // Gridline per whole employee. With a count of 0-3 the steps are only a few
    // pixels apart, and without these the line reads as noise rather than as
    // discrete people.
    if (maxVal <= 6) {
      ctx.strokeStyle = '#eceef3';
      ctx.lineWidth = 1;
      for (let v = 0; v <= maxVal; v++) {
        const y = Math.round(yOf(v)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(padL + plotW, y);
        ctx.stroke();
      }
    }

    // Everything observed so far. Nothing beyond it is drawn.
    const seen = [];
    for (const r of kitchenRows) {
      if (r.timeSeconds > currentT) break;
      seen.push(r);
    }
    if (!seen.length) return;                   // before the first reading

    const nowX = Math.max(xOf(seen[seen.length - 1].timeSeconds), xOf(currentT));
    const nowY = yOf(seen[seen.length - 1].employees);

    const stepPath = () => {
      ctx.beginPath();
      ctx.moveTo(xOf(seen[0].timeSeconds), yOf(seen[0].employees));
      for (let i = 1; i < seen.length; i++) {
        const x = xOf(seen[i].timeSeconds);
        ctx.lineTo(x, yOf(seen[i - 1].employees));   // hold the previous value
        ctx.lineTo(x, yOf(seen[i].employees));       // then step to the new one
      }
      ctx.lineTo(nowX, nowY);                        // hold out to the playhead
    };

    // Fill fades downward so the line stays the emphasis rather than the block.
    const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    grad.addColorStop(0, 'rgba(46,49,146,0.20)');
    grad.addColorStop(1, 'rgba(46,49,146,0.02)');
    stepPath();
    ctx.lineTo(nowX, padT + plotH);
    ctx.lineTo(xOf(seen[0].timeSeconds), padT + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    stepPath();
    ctx.strokeStyle = '#2E3192';
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'miter';
    ctx.stroke();

    // Leading marker, ringed in the panel colour so it reads on top of the fill.
    ctx.beginPath();
    ctx.arc(nowX, nowY, 3.4, 0, Math.PI * 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(nowX, nowY, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = '#2E3192';
    ctx.fill();
  }

  // The canvas is sized by flexbox, so it has no width until layout settles and
  // it changes on every resize.
  requestAnimationFrame(() => drawEmpChart(kitchenVideo.currentTime || 0));
  window.addEventListener('resize', () => drawEmpChart(kitchenVideo.currentTime || 0));

  function updateBilling() {
    const t = billingVideo.currentTime;
    const bRow = findRow(billingRows, t);
    if (bRow) elBillingQ.textContent = bRow.billing_count;

    // Running mean over the transactions finished by now — nothing from the future.
    const done = serviceEvents.filter(e => e.timeSeconds <= t);
    elAvgBilling.textContent = done.length
      ? fmtSecs(done.reduce((sum, e) => sum + e.duration, 0) / done.length)
      : '—';
  }

  billingVideo.addEventListener('timeupdate', updateBilling);
  billingVideo.addEventListener('seeked', updateBilling);

}
