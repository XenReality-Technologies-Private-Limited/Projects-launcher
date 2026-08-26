import { TimeSeriesGraph } from './graph.js';

function syncCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    canvas.width  = Math.round(rect.width);
    canvas.height = Math.round(rect.height);
  }
}

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

function buildPerSecSeries(rows, key, maxT) {
  const series = new Array(maxT + 1).fill(null);
  for (const r of rows) {
    const t = Math.round(r.timeSeconds);
    if (t <= maxT) series[t] = r[key];
  }
  let last = 0;
  for (let i = 0; i < series.length; i++) {
    if (series[i] !== null) last = series[i];
    else series[i] = last;
  }
  return series;
}

function buildVioSeries(kitchenRows) {
  if (!kitchenRows.length) return [];
  const maxT = Math.ceil(kitchenRows[kitchenRows.length - 1].timeSeconds);
  const series = new Array(maxT + 1).fill(0);
  let cur = 0;
  for (const r of kitchenRows) {
    const t = Math.round(r.timeSeconds);
    cur = r.gloves_off + r.hairnet_off;
    series[t] = cur;
  }
  // forward-fill sparse rows
  for (let i = 1; i < series.length; i++) {
    if (series[i] === 0 && series[i - 1] > 0) series[i] = series[i - 1];
  }
  return series;
}

// kept for compat but no longer used for SVG
function buildViolationsChart(kitchenRows) {
  if (kitchenRows.length < 2) return null;

  // Layout constants
  const PL = 28, PR = 8, PT = 8, PB = 22; // padding left/right/top/bottom
  const TW = 500, TH = 100;               // total SVG size
  const W  = TW - PL - PR;               // chart area width
  const H  = TH - PT - PB;               // chart area height

  const maxT   = kitchenRows[kitchenRows.length - 1].timeSeconds || 1;
  const maxVio = Math.max(2, ...kitchenRows.map(r => r.gloves_off + r.hairnet_off));

  const cx = t   => PL + (t / maxT) * W;
  const cy = vio => PT + H - (vio / maxVio) * H;

  // Step-chart points
  const pts = [];
  kitchenRows.forEach((r, i) => {
    const vio = r.gloves_off + r.hairnet_off;
    const x = cx(r.timeSeconds), y = cy(vio);
    if (i > 0) pts.push(`${x.toFixed(1)},${pts[pts.length - 1].split(',')[1]}`);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  const ptStr  = pts.join(' ');
  const baseY  = PT + H;
  const firstX = cx(kitchenRows[0].timeSeconds);

  // X-axis time labels every 60s
  const xLabels = [];
  for (let t = 0; t <= maxT; t += 60) {
    const x = cx(t);
    const m = Math.floor(t / 60);
    xLabels.push(`<text x="${x.toFixed(1)}" y="${TH - 4}" text-anchor="middle" font-size="9" fill="#9ca3af">${m}m</text>`);
    xLabels.push(`<line x1="${x.toFixed(1)}" y1="${(PT + H).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(PT + H + 3).toFixed(1)}" stroke="#d1d5db" stroke-width="1"/>`);
  }

  // Y-axis labels
  const yLabels = [];
  for (let v = 0; v <= maxVio; v++) {
    const y = cy(v);
    yLabels.push(`<text x="${PL - 4}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="#9ca3af">${v}</text>`);
    yLabels.push(`<line x1="${PL}" y1="${y.toFixed(1)}" x2="${(PL + W).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#f3f4f6" stroke-width="1"/>`);
  }

  return { svg: `
    <svg viewBox="0 0 ${TW} ${TH}" class="compliance-chart" style="height:100px">
      ${yLabels.join('')}
      <polyline points="${firstX.toFixed(1)},${baseY} ${ptStr} ${(PL+W).toFixed(1)},${baseY}"
        fill="#fee2e2" stroke="none"/>
      <polyline points="${ptStr}" fill="none" stroke="#ef4444" stroke-width="1.8"
        stroke-linecap="round"/>
      <line x1="${PL}" y1="${PT}" x2="${PL}" y2="${baseY}" stroke="#e5e7eb" stroke-width="1"/>
      <line x1="${PL}" y1="${baseY}" x2="${(PL+W).toFixed(1)}" y2="${baseY}" stroke="#e5e7eb" stroke-width="1"/>
      ${xLabels.join('')}
      <!-- future overlay -->
      <rect id="chart-future" x="${PL}" y="${PT}" width="${W}" height="${H}"
        fill="white" opacity="0.55"/>
      <!-- playhead -->
      <line id="chart-playhead" x1="${PL}" y1="${PT}" x2="${PL}" y2="${baseY}"
        stroke="#374151" stroke-width="1.5" stroke-dasharray="3,2"/>
    </svg>`, PL, W, maxT };
}

export function renderDashboard(appEl, { kitchenVideoUrl, billingVideoUrl }, { kitchenRows }, { billingRows, waitingRows, billingEvents }) {
  const vioSeries = buildVioSeries(kitchenRows);
  const vioYMax   = Math.max(5, ...vioSeries);

  const bMaxT = billingRows.length ? Math.ceil(billingRows[billingRows.length - 1].timeSeconds) : 300;
  const wMaxT = waitingRows.length ? Math.ceil(waitingRows[waitingRows.length - 1].timeSeconds) : 300;
  const billingActSeries = buildPerSecSeries(billingRows, 'billing_count', Math.max(bMaxT, wMaxT));
  const waitingActSeries = buildPerSecSeries(waitingRows, 'waiting_count', Math.max(bMaxT, wMaxT));
  const billingActYMax   = Math.max(5, ...billingRows.map(r => r.billing_count));
  const waitingActYMax   = Math.max(5, ...waitingRows.map(r => r.waiting_count));

  appEl.innerHTML = `
    <header class="dash-header">
      <div class="header-xr-block">
        <div class="header-logo-pill"><img src="https://d108xxen99ni2a.cloudfront.net/XenRealitylogo.webp" alt="XenReality" /></div>
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

      <!-- Kitchen PPE -->
      <div class="panel">
        <div class="video-header"><span class="video-label">Kitchen — PPE Compliance</span></div>
        <div class="panel-body">
          <video id="kitchen-video" src="${kitchenVideoUrl}" controls muted playsinline autoplay class="panel-video"></video>
          <div class="kpi-col">
            <div class="ppe-section-header">PPE Compliance</div>
            <div class="ppe-compliance-summary">
              <div class="ppe-pct" id="compliance-pct">—</div>
              <div class="ppe-status">
                <span class="status-dot" id="status-dot"></span>
                <span id="status-label">—</span>
              </div>
            </div>
            <div class="ppe-grid-2x2">
              <div class="ppe-box ppe-box--green">
                <div class="ppe-box-label">Gloves ON</div>
                <div class="ppe-box-value" id="gloves-on">—</div>
              </div>
              <div class="ppe-box ppe-box--red">
                <div class="ppe-box-label">Gloves OFF</div>
                <div class="ppe-box-value" id="gloves-off">—</div>
              </div>
              <div class="ppe-box ppe-box--green">
                <div class="ppe-box-label">Hairnet ON</div>
                <div class="ppe-box-value" id="hairnet-on">—</div>
              </div>
              <div class="ppe-box ppe-box--red">
                <div class="ppe-box-label">Hairnet OFF</div>
                <div class="ppe-box-value" id="hairnet-off">—</div>
              </div>
            </div>
            <div class="ppe-history">
              <div class="ppe-history-label">Violations Over Time</div>
              <canvas id="vio-canvas" class="vio-canvas" width="600" height="180"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Billing / Waiting -->
      <div class="panel">
        <div class="video-header"><span class="video-label">Billing &amp; Waiting Area</span></div>
        <div class="panel-body">
          <video id="billing-video" src="${billingVideoUrl}" controls muted playsinline autoplay class="panel-video"></video>
          <div class="kpi-col">
            <div class="ops-kpi-row">
              <div class="ops-kpi-cell">
                <div class="ops-card-label">Billing Queue</div>
                <div class="ops-card-value" id="billing-queue">—</div>
                <div class="ops-status"><span class="status-dot" id="bq-dot"></span><span id="bq-label">—</span></div>
              </div>
              <canvas id="billing-activity-canvas" class="ops-mini-graph" width="600" height="90"></canvas>
            </div>
            <div class="ops-avg-row">
              <div class="ops-card-label">Avg Billing Time</div>
              <div class="ops-card-value ops-card-value--sm" id="avg-billing">—</div>
              <div class="ops-status"><span class="status-dot" id="abt-dot"></span><span id="abt-label">—</span></div>
            </div>
            <div class="ops-kpi-row">
              <div class="ops-kpi-cell">
                <div class="ops-card-label">Waiting for Food</div>
                <div class="ops-card-value" id="waiting-count">—</div>
                <div class="ops-status"><span class="status-dot" id="wf-dot"></span><span id="wf-label">—</span></div>
              </div>
              <canvas id="waiting-activity-canvas" class="ops-mini-graph" width="600" height="90"></canvas>
            </div>
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

  const kitchenVideo = appEl.querySelector('#kitchen-video');
  const billingVideo = appEl.querySelector('#billing-video');

  const elGlovesOn      = appEl.querySelector('#gloves-on');
  const elGlovesOff     = appEl.querySelector('#gloves-off');
  const elHairnetOn     = appEl.querySelector('#hairnet-on');
  const elHairnetOff    = appEl.querySelector('#hairnet-off');
  const elCompliancePct = appEl.querySelector('#compliance-pct');
  const elStatusDot     = appEl.querySelector('#status-dot');
  const elStatusLabel   = appEl.querySelector('#status-label');
  const vioCanvas = appEl.querySelector('#vio-canvas');
  let vioGraph = null;
  if (vioCanvas) {
    vioGraph = new TimeSeriesGraph(vioCanvas, {
      lineColor: '#ef4444',
      playheadColor: '#6b7280',
      yMax: vioYMax,
      showLiveCount: true,
      showTimeLabels: true,
      showYLabels: true,
      fullRange: true,
    });
    vioGraph.setValues(vioSeries);
  }
  const billingActCanvas = appEl.querySelector('#billing-activity-canvas');
  const waitingActCanvas = appEl.querySelector('#waiting-activity-canvas');
  let billingActGraph = null, waitingActGraph = null;
  if (billingActCanvas) {
    billingActGraph = new TimeSeriesGraph(billingActCanvas, {
      lineColor: '#2563eb', playheadColor: '#6b7280',
      yMax: billingActYMax, showYLabels: true, showTimeLabels: true, fullRange: true,
    });
    billingActGraph.setValues(billingActSeries);
  }
  if (waitingActCanvas) {
    waitingActGraph = new TimeSeriesGraph(waitingActCanvas, {
      lineColor: '#f59e0b', playheadColor: '#6b7280',
      yMax: waitingActYMax, showYLabels: true, showTimeLabels: true, fullRange: true,
    });
    waitingActGraph.setValues(waitingActSeries);
  }

  const elBillingQ    = appEl.querySelector('#billing-queue');
  const elAvgBilling  = appEl.querySelector('#avg-billing');
  const elWaiting     = appEl.querySelector('#waiting-count');
  const elBqDot       = appEl.querySelector('#bq-dot');
  const elBqLabel     = appEl.querySelector('#bq-label');
  const elAbtDot      = appEl.querySelector('#abt-dot');
  const elAbtLabel    = appEl.querySelector('#abt-label');
  const elWfDot       = appEl.querySelector('#wf-dot');
  const elWfLabel     = appEl.querySelector('#wf-label');
  function updateKitchen() {
    const row = findRow(kitchenRows, kitchenVideo.currentTime);
    if (!row) return;
    elGlovesOn.textContent   = row.gloves_on;
    elGlovesOff.textContent  = row.gloves_off;
    elHairnetOn.textContent  = row.hairnet_on;
    elHairnetOff.textContent = row.hairnet_off;

    const total     = row.gloves_on + row.gloves_off + row.hairnet_on + row.hairnet_off;
    const compliant = row.gloves_on + row.hairnet_on;
    const pct       = total > 0 ? Math.round((compliant / total) * 100) : 100;

    elCompliancePct.textContent = `${pct}%`;
    const healthy = row.gloves_off === 0 && row.hairnet_off === 0;
    elStatusDot.style.background = healthy ? '#10b981' : '#ef4444';
    elStatusLabel.textContent    = healthy ? 'HEALTHY' : 'WARNING';

    if (vioGraph && vioCanvas) {
      syncCanvas(vioCanvas);
      vioGraph.setCurrentIndex(Math.round(kitchenVideo.currentTime));
      vioGraph.render();
    }
  }

  // Extend vioSeries to full video duration so the graph x-axis matches the video
  kitchenVideo.addEventListener('loadedmetadata', () => {
    const dur = Math.ceil(kitchenVideo.duration);
    if (vioSeries.length <= dur) {
      const last = vioSeries[vioSeries.length - 1] || 0;
      while (vioSeries.length <= dur) vioSeries.push(last);
      if (vioGraph) vioGraph.setValues(vioSeries);
    }
  });

  kitchenVideo.addEventListener('timeupdate', updateKitchen);
  kitchenVideo.addEventListener('seeked', updateKitchen);

  function updateBilling() {
    const t    = billingVideo.currentTime;
    const bRow = findRow(billingRows, t);
    const wRow = findRow(waitingRows, t);
    if (bRow) {
      elBillingQ.textContent = bRow.billing_count;
      const bHigh = bRow.billing_count > 3;
      elBqDot.style.background = bHigh ? '#ef4444' : '#10b981';
      elBqLabel.textContent    = bHigh ? 'HIGH' : 'NORMAL';
    }
    if (wRow) {
      elWaiting.textContent = wRow.waiting_count;
      const wHigh = wRow.waiting_count > 5;
      elWfDot.style.background = wHigh ? '#f59e0b' : '#10b981';
      elWfLabel.textContent    = wHigh ? 'HIGH' : 'NORMAL';
    }
    // Running average: past events if any, else fall back to session-wide average
    const pastEvents = billingEvents.filter(e => e.timeSeconds <= t);
    const eventsToAvg = pastEvents.length > 0 ? pastEvents : billingEvents;
    if (eventsToAvg.length) {
      const avg = eventsToAvg.reduce((s, e) => s + e.duration, 0) / eventsToAvg.length;
      elAvgBilling.textContent = fmtSecs(avg);
      const slow = avg > 60;
      elAbtDot.style.background = slow ? '#f59e0b' : '#10b981';
      elAbtLabel.textContent    = slow ? 'SLOW' : 'GOOD';
    }
    if (billingActGraph && billingActCanvas) {
      syncCanvas(billingActCanvas);
      billingActGraph.setCurrentIndex(Math.round(t));
      billingActGraph.render();
    }
    if (waitingActGraph && waitingActCanvas) {
      syncCanvas(waitingActCanvas);
      waitingActGraph.setCurrentIndex(Math.round(t));
      waitingActGraph.render();
    }
  }

  // Extend activity series to full billing video duration
  billingVideo.addEventListener('loadedmetadata', () => {
    const dur = Math.ceil(billingVideo.duration);
    [billingActSeries, waitingActSeries].forEach((s, idx) => {
      if (s.length <= dur) {
        const last = s[s.length - 1] || 0;
        while (s.length <= dur) s.push(last);
      }
    });
    if (billingActGraph) billingActGraph.setValues(billingActSeries);
    if (waitingActGraph) waitingActGraph.setValues(waitingActSeries);
  });

  billingVideo.addEventListener('timeupdate', updateBilling);
  billingVideo.addEventListener('seeked', updateBilling);
}
