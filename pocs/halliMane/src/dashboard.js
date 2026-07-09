import { TimeSeriesGraph } from './graph.js';

const IST_TIME_OPTIONS = { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' };
function formatISTTime() { return new Date().toLocaleTimeString('en-IN', IST_TIME_OPTIONS); }
function formatSecs(s) {
  const t = Math.round(s || 0);
  return `${Math.floor(t / 60).toString().padStart(2, '0')}:${(t % 60).toString().padStart(2, '0')}`;
}

// SVG icons
const ICONS = {
  cash:    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/><circle cx="12" cy="14" r="2"/></svg>`,
  payment: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`,
  cashier: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><line x1="12" y1="17" x2="12" y2="21" stroke-dasharray="2 2"/></svg>`,
  wait:    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  payout:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  zone:    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>`,
  table:   `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/></svg>`,
  apron:   `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a5 5 0 0 1 5 5v3H7V7a5 5 0 0 1 5-5z"/><path d="M7 10v10a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V10"/></svg>`,
};

function presenceBadge(present, labelPresent = 'Present', labelAbsent = 'Absent') {
  const cls = present ? 'badge badge-present' : 'badge badge-absent';
  return `<span class="${cls}">${present ? labelPresent : labelAbsent}</span>`;
}


function attachGraph(canvas, series, color, yMax) {
  const graph = new TimeSeriesGraph(canvas, { yMax: Math.ceil(yMax * 1.2) || 5, lineColor: color, playheadColor: '#6b7280' });
  graph.setValues(series);
  const ro = new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    graph.render();
  });
  ro.observe(canvas);
  return graph;
}

function buildShell(title, icon, badgeHtml, camLabel, videoUrl) {
  const section = document.createElement('section');
  section.className = 'kpi-card';
  section.innerHTML = `
    <div class="kpi-header">
      <div class="kpi-title-wrap">
        <span class="kpi-title-icon">${icon}</span>
        <h2 class="kpi-title">${title}</h2>
      </div>
      <div class="badge-row header-badges">${badgeHtml}</div>
    </div>
    <div class="kpi-body">
      <div class="kpi-video-container">
        <span class="kpi-video-label">${camLabel}</span>
        <video class="kpi-video" controls muted playsinline autoplay loop></video>
      </div>
      <div class="kpi-right" id="right-panel"></div>
    </div>`;
  section.querySelector('.kpi-video').src = videoUrl;
  return section;
}

// ── 1. Cash Given to Staff ─────────────────────────────────────────────────
export function buildCashStaffCard(cam, index, data) {
  const section = buildShell('Cash Given to Staff', ICONS.cash, '<span class="badge badge-present">Active</span>', `CAM-${String(index + 1).padStart(2, '0')}`, cam.videoUrl);
  const right = section.querySelector('#right-panel');
  right.innerHTML = `
    <div class="presence-pair">
      <div>
        <div class="kpi-metric-label">Cashier</div>
        <div id="cs-cashier-badge"></div>
      </div>
      <div>
        <div class="kpi-metric-label">Staff</div>
        <div id="cs-staff-badge"></div>
      </div>
    </div>
    <div class="kpi-metric-label">Customer Count</div>
    <div class="kpi-metric-value" id="cs-cust">--</div>
    <div class="kpi-metric-label">Cash Drawer</div>
    <div id="cs-drawer-badge"></div>
    <div class="kpi-divider"></div>
    <div class="kpi-metric-label">Events</div>
    <div class="event-row event-row-alert" id="cs-cash-to-staff-row">
      <span class="event-row-icon">&#9888;</span>
      <span class="event-row-label">Cash &#8594; Staff</span>
      <span class="event-row-status" id="cs-cash-to-staff-status">Not detected</span>
    </div>
    <div class="event-log" id="cs-event-log"></div>
    <div class="event-row event-row-info" id="cs-cust-cash-row">
      <span class="event-row-icon">&#128181;</span>
      <span class="event-row-label">Received cash from customer</span>
      <span class="event-row-status" id="cs-cust-cash-status">Not detected</span>
    </div>
    <div class="event-log event-log-info" id="cs-cust-cash-log"></div>`;

  if (!data) return section;
  const { rows } = data;

  const cashierBadgeEl     = right.querySelector('#cs-cashier-badge');
  const staffBadgeEl       = right.querySelector('#cs-staff-badge');
  const custEl             = right.querySelector('#cs-cust');
  const drawerBadgeEl      = right.querySelector('#cs-drawer-badge');
  const cashToStaffRow     = right.querySelector('#cs-cash-to-staff-row');
  const cashToStaffStatus  = right.querySelector('#cs-cash-to-staff-status');
  const eventLog           = right.querySelector('#cs-event-log');
  const custCashRow        = right.querySelector('#cs-cust-cash-row');
  const custCashStatus     = right.querySelector('#cs-cust-cash-status');
  const custCashLog        = right.querySelector('#cs-cust-cash-log');

  // Only capture the first second of each continuous event run (transition 0 → >0)
  const cashToStaffEvents = rows
    .filter((r, i) => r.cash_to_staff > 0 && (i === 0 || rows[i - 1].cash_to_staff === 0))
    .map((r) => ({ video_time: r.video_time, timeSeconds: r.timeSeconds }));

  const custCashEvents = rows
    .filter((r, i) => r.customer_cash > 0 && (i === 0 || rows[i - 1].customer_cash === 0))
    .map((r) => ({ video_time: r.video_time, timeSeconds: r.timeSeconds }));

  const video = section.querySelector('.kpi-video');
  function update() {
    if (!rows.length) return;
    const idx = Math.min(Math.floor(video.currentTime || 0), rows.length - 1);
    const row = rows[idx];

    cashierBadgeEl.innerHTML = presenceBadge(row.employee_present);
    staffBadgeEl.innerHTML   = presenceBadge(row.staff_present);
    custEl.textContent       = String(row.customer_count);
    drawerBadgeEl.innerHTML  = `<span class="badge badge-open">Open</span>`;

    const csActive = row.cash_to_staff > 0;
    cashToStaffRow.classList.toggle('active', csActive);
    cashToStaffStatus.textContent = csActive ? 'DETECTED' : 'Not detected';

    // Show all events that have occurred up to the current video second
    const currentSecs = rows[idx]?.timeSeconds ?? 0;
    const visibleEvents = cashToStaffEvents.filter((e) => e.timeSeconds <= currentSecs);
    eventLog.innerHTML = visibleEvents.length
      ? visibleEvents.map((e) =>
          `<div class="event-log-entry">
            <span class="event-log-dot"></span>
            <span class="event-log-time">${e.video_time}</span>
            <span class="event-log-text">Cash handed to staff</span>
          </div>`
        ).join('')
      : '';

    const ccActive = row.customer_cash > 0;
    custCashRow.classList.toggle('active', ccActive);
    custCashStatus.textContent = ccActive ? 'RECEIVED' : 'Not detected';

    const visibleCustCash = custCashEvents.filter((e) => e.timeSeconds <= currentSecs);
    custCashLog.innerHTML = visibleCustCash.length
      ? visibleCustCash.map((e) =>
          `<div class="event-log-entry event-log-entry-info">
            <span class="event-log-dot event-log-dot-info"></span>
            <span class="event-log-time event-log-time-info">${e.video_time}</span>
            <span class="event-log-text">Received cash from customer</span>
          </div>`
        ).join('')
      : '';
  }
  video.addEventListener('loadedmetadata', update);
  video.addEventListener('timeupdate', update);
  return section;
}

// ── 2. Payment Transactions ────────────────────────────────────────────────
export function buildPaymentCard(cam, index, data) {
  const section = buildShell('Payment Transactions', ICONS.payment, '<span class="badge badge-present">Active</span>', `CAM-${String(index + 1).padStart(2, '0')}`, cam.videoUrl);
  const right = section.querySelector('#right-panel');
  right.innerHTML = `
    <div class="kpi-metric-label">Customers in Zone</div>
    <div class="kpi-metric-value" id="pt-count">0</div>
    <div class="kpi-divider"></div>
    <div class="kpi-metric-label">Transaction Log</div>
    <div class="txn-table-wrap">
      <table class="txn-table">
        <thead><tr><th>Time</th><th>Payment</th><th>Bill</th><th>Alert</th></tr></thead>
        <tbody id="pt-txn-body"><tr><td colspan="4" class="txn-empty">No transactions yet</td></tr></tbody>
      </table>
    </div>`;

  if (!data) return section;
  const { rows } = data;

  // Capture transaction events: successful payment (valid_transaction→1 with payment_type)
  // or alert transition (null→value). Only the first second of each event.
  const transactions = [];
  rows.forEach((row, i) => {
    const prev = i > 0 ? rows[i - 1] : null;
    const validNow = row.valid_transaction && row.payment_type;
    const validBefore = prev && prev.valid_transaction && prev.payment_type;
    if (validNow && !validBefore) transactions.push(row);

    const alertNow = row.alert;
    const alertBefore = prev ? prev.alert : null;
    if (alertNow && alertNow !== alertBefore) transactions.push(row);
  });

  const countEl   = right.querySelector('#pt-count');
  const txnBody   = right.querySelector('#pt-txn-body');
  const video     = section.querySelector('.kpi-video');

  function txnRow(t) {
    const pt = t.payment_type ? t.payment_type.toUpperCase() : '—';
    const bill = t.bill_issued ? '✓' : '✗';
    const alertText = t.alert || '—';
    const alertCls = t.alert ? 'txn-alert' : 'txn-ok';
    return `<tr>
      <td class="txn-time">${t.video_time}</td>
      <td>${pt}</td>
      <td class="${t.bill_issued ? 'txn-ok' : ''}">${bill}</td>
      <td class="${alertCls}">${alertText}</td>
    </tr>`;
  }

  function update() {
    if (!rows.length) return;
    const idx = Math.min(Math.floor(video.currentTime || 0), rows.length - 1);
    const row = rows[idx];
    const currentSecs = row.timeSeconds ?? 0;

    countEl.textContent = String(row.customer_count);

    const visible = transactions.filter((t) => t.timeSeconds <= currentSecs);
    txnBody.innerHTML = visible.length
      ? visible.map(txnRow).join('')
      : `<tr><td colspan="4" class="txn-empty">No transactions yet</td></tr>`;
  }
  video.addEventListener('loadedmetadata', update);
  video.addEventListener('timeupdate', update);
  return section;
}

// ── 2b. Payment Transactions 2 ────────────────────────────────────────────
export function buildPayment2Card(cam, index, data) {
  const section = buildShell('Payment Transactions 2', ICONS.payment, '<span class="badge badge-present">Active</span>', `CAM-${String(index + 1).padStart(2, '0')}`, cam.videoUrl);
  const right = section.querySelector('#right-panel');
  right.innerHTML = `
    <div class="kpi-metric-label">Customers in Zone</div>
    <div class="kpi-metric-value" id="pt2-count">0</div>
    <div class="kpi-divider"></div>
    <div class="kpi-metric-label">Transaction Log</div>
    <div class="txn-table-wrap">
      <table class="txn-table">
        <thead><tr><th>Time</th><th>Payment</th><th>Bill</th><th>Alert</th></tr></thead>
        <tbody id="pt2-txn-body"><tr><td colspan="4" class="txn-empty">No transactions yet</td></tr></tbody>
      </table>
    </div>`;

  if (!data) return section;
  const { rows } = data;

  const transactions = [];
  rows.forEach((row, i) => {
    const prev = i > 0 ? rows[i - 1] : null;
    const validNow = row.valid_transaction && row.payment_type;
    const validBefore = prev && prev.valid_transaction && prev.payment_type;
    if (validNow && !validBefore) transactions.push(row);

    const alertNow = row.alert;
    const alertBefore = prev ? prev.alert : null;
    if (alertNow && alertNow !== alertBefore) transactions.push(row);
  });

  const countEl = right.querySelector('#pt2-count');
  const txnBody = right.querySelector('#pt2-txn-body');
  const video   = section.querySelector('.kpi-video');

  function txnRow(t) {
    const pt = t.payment_type ? t.payment_type.toUpperCase() : '—';
    // Valid transactions always have bill issued; CARD bill is given before payment processes
    const bill = (t.valid_transaction || t.bill_issued) ? '✓' : '✗';
    let alertText, alertCls;
    if (t.alert) {
      alertText = t.alert; alertCls = 'txn-alert';
    } else if (pt === 'CARD') {
      alertText = 'Bill given before payment'; alertCls = 'txn-alert';
    } else if (!t.valid_transaction && !t.bill_issued) {
      alertText = 'NO_BILL'; alertCls = 'txn-alert';
    } else if (!t.payment_type) {
      alertText = 'NO_PAYMENT'; alertCls = 'txn-alert';
    } else {
      alertText = '—'; alertCls = 'txn-ok';
    }
    return `<tr>
      <td class="txn-time">${t.video_time}</td>
      <td>${pt}</td>
      <td class="${bill === '✓' ? 'txn-ok' : ''}">${bill}</td>
      <td class="${alertCls}">${alertText}</td>
    </tr>`;
  }

  function update() {
    if (!rows.length) return;
    const idx = Math.min(Math.floor(video.currentTime || 0), rows.length - 1);
    const row = rows[idx];
    const currentSecs = row.timeSeconds ?? 0;
    countEl.textContent = String(row.customer_count);
    const visible = transactions.filter((t) => t.timeSeconds <= currentSecs);
    txnBody.innerHTML = visible.length
      ? visible.map(txnRow).join('')
      : `<tr><td colspan="4" class="txn-empty">No transactions yet</td></tr>`;
  }
  video.addEventListener('loadedmetadata', update);
  video.addEventListener('timeupdate', update);
  return section;
}

// ── 3. Cashier Not in Frame ────────────────────────────────────────────────
export function buildCashierAbsenceCard(cam, index, data) {
  const section = buildShell('Cashier Not in Frame', ICONS.cashier, '<span class="badge badge-present">Monitoring</span>', `CAM-${String(index + 1).padStart(2, '0')}`, cam.videoUrl);
  const right = section.querySelector('#right-panel');
  right.innerHTML = `
    <div class="kpi-metric-label">Cashier Status</div>
    <div class="badge-row" id="ca-cashier-badge"></div>
    <div class="kpi-metric-label">Cash Drawer</div>
    <div class="badge-row" id="ca-drawer-badge"></div>
    <div class="kpi-metric-label">Unattended Time</div>
    <div class="kpi-metric-value" id="ca-unattended">00:00</div>
    <div class="kpi-metric-sub">MM:SS unattended</div>
    <div class="kpi-metric-label">Alert</div>
    <div class="badge-row" id="ca-alert-badge"></div>
    <canvas class="kpi-graph" width="600" height="140"></canvas>
    <div class="kpi-legend">Unattended seconds over time</div>`;

  if (!data) return section;
  const { rows, unattendedSeries } = data;
  const canvas = right.querySelector('canvas');
  const graph = attachGraph(canvas, unattendedSeries, '#ef4444', Math.max(5, ...unattendedSeries));

  const cashierBadgeEl = right.querySelector('#ca-cashier-badge');
  const drawerBadgeEl  = right.querySelector('#ca-drawer-badge');
  const unattendedEl   = right.querySelector('#ca-unattended');
  const alertBadgeEl   = right.querySelector('#ca-alert-badge');
  const video = section.querySelector('.kpi-video');

  function update() {
    if (!rows.length) return;
    const idx = Math.min(Math.floor(video.currentTime || 0), rows.length - 1);
    const row = rows[idx];
    cashierBadgeEl.innerHTML = presenceBadge(row.cashier_present);
    drawerBadgeEl.innerHTML  = row.drawer_open
      ? `<span class="badge badge-open">Open</span>`
      : `<span class="badge badge-closed">Closed</span>`;
    unattendedEl.textContent = formatSecs(row.unattended_secs);
    alertBadgeEl.innerHTML   = row.alert
      ? `<span class="badge badge-alert">${row.alert}</span>`
      : `<span class="badge badge-ok">Clear</span>`;
    graph.setCurrentIndex(idx);
    graph.render();
  }
  video.addEventListener('loadedmetadata', update);
  video.addEventListener('timeupdate', update);
  return section;
}

// ── 4. Customer Waiting ────────────────────────────────────────────────────
export function buildCustomerWaitCard(cam, index, data) {
  const section = buildShell('Customer Waiting', ICONS.wait, '<span class="badge badge-present">Monitoring</span>', `CAM-${String(index + 1).padStart(2, '0')}`, cam.videoUrl);
  const right = section.querySelector('#right-panel');
  right.innerHTML = `
    <div class="kpi-metric-label">Customers Waiting</div>
    <div class="kpi-metric-value" id="cw-count">0</div>
    <div class="kpi-metric-label">Wait Time</div>
    <div class="kpi-metric-value" id="cw-wait">00:00</div>
    <div class="kpi-metric-sub">MM:SS waited</div>
    <div class="kpi-metric-label">Employee Arrived</div>
    <div class="badge-row" id="cw-emp-badge"></div>
    <div class="kpi-divider"></div>
    <div class="kpi-metric-label">Wait Log</div>
    <div class="txn-table-wrap">
      <table class="txn-table">
        <thead><tr><th>Time</th><th>Payment</th><th>Bill</th><th>Alert</th></tr></thead>
        <tbody id="cw-txn-body"><tr><td colspan="4" class="txn-empty">No events yet</td></tr></tbody>
      </table>
    </div>`;

  if (!data) return section;
  const { rows } = data;

  // Capture only rows where payment_type is recorded (transition: null → value)
  const waitEvents = rows.filter((r, i) =>
    r.payment_type && (i === 0 || !rows[i - 1].payment_type)
  );

  const countEl  = right.querySelector('#cw-count');
  const waitEl   = right.querySelector('#cw-wait');
  const empBadge = right.querySelector('#cw-emp-badge');
  const txnBody  = right.querySelector('#cw-txn-body');
  const video    = section.querySelector('.kpi-video');

  function waitRow(t) {
    const pt = t.payment_type ? t.payment_type.toUpperCase() : '—';
    const bill = t.bill_issued ? '✓' : '✗';
    const alertText = t.alert || '—';
    const alertCls = t.alert ? 'txn-alert' : 'txn-ok';
    return `<tr>
      <td class="txn-time">${t.video_time}</td>
      <td>${pt}</td>
      <td class="${t.bill_issued ? 'txn-ok' : ''}">${bill}</td>
      <td class="${alertCls}">${alertText}</td>
    </tr>`;
  }

  function update() {
    if (!rows.length) return;
    const idx = Math.min(Math.floor(video.currentTime || 0), rows.length - 1);
    const row = rows[idx];
    const currentSecs = row.timeSeconds ?? 0;
    countEl.textContent = row.customer_id != null ? '1' : '0';
    waitEl.textContent = formatSecs(row.wait_secs);
    empBadge.innerHTML = presenceBadge(row.employee_arrived, 'Arrived', 'Not Yet');
    const visible = waitEvents.filter((e) => e.timeSeconds <= currentSecs);
    txnBody.innerHTML = visible.length
      ? visible.map(waitRow).join('')
      : `<tr><td colspan="4" class="txn-empty">No events yet</td></tr>`;
  }
  video.addEventListener('loadedmetadata', update);
  video.addEventListener('timeupdate', update);
  return section;
}

// ── 5. Money Given by Cashier ──────────────────────────────────────────────
export function buildCashierPayoutCard(cam, index, data) {
  const section = buildShell('Money Given by Cashier', ICONS.payout, '<span class="badge badge-present">Active</span>', `CAM-${String(index + 1).padStart(2, '0')}`, cam.videoUrl);
  const right = section.querySelector('#right-panel');
  right.innerHTML = `
    <div class="kpi-metric-label">Cashier in Zone</div>
    <div class="badge-row" id="cp-cashier-badge"></div>
    <div class="kpi-divider"></div>
    <div class="kpi-metric-label">Cash Exchange Events</div>
    <div class="txn-table-wrap">
      <table class="txn-table">
        <thead><tr><th>Time</th><th>Cash from Drawer</th><th>Cash to Customer</th></tr></thead>
        <tbody id="cp-txn-body"><tr><td colspan="3" class="txn-empty">No events yet</td></tr></tbody>
      </table>
    </div>`;

  if (!data) return section;
  const { rows } = data;

  // Capture the moment cash is handed to customer (0→1 transition on cash_in_customer_zone)
  const cashEvents = rows.filter((r, i) =>
    r.cash_in_customer_zone && (i === 0 || !rows[i - 1].cash_in_customer_zone)
  );

  const cashierBadge = right.querySelector('#cp-cashier-badge');
  const txnBody      = right.querySelector('#cp-txn-body');
  const video        = section.querySelector('.kpi-video');

  function update() {
    if (!rows.length) return;
    const idx = Math.min(Math.floor(video.currentTime || 0), rows.length - 1);
    const row = rows[idx];
    const currentSecs = row.timeSeconds ?? 0;
    cashierBadge.innerHTML = presenceBadge(row.cashier_in_zone);
    const visible = cashEvents.filter((e) => e.timeSeconds <= currentSecs);
    txnBody.innerHTML = visible.length
      ? visible.map((e) => `<tr>
          <td class="txn-time">${e.video_time}</td>
          <td class="txn-ok">${e.cash_from_drawer ? 'Yes ✓' : 'No'}</td>
          <td class="txn-ok">${e.cash_in_customer_zone ? 'Yes ✓' : 'No'}</td>
        </tr>`).join('')
      : `<tr><td colspan="3" class="txn-empty">No events yet</td></tr>`;
  }
  video.addEventListener('loadedmetadata', update);
  video.addEventListener('timeupdate', update);
  return section;
}

// ── 6. Cylinder Zone ──────────────────────────────────────────────────────
export function buildCylinderZoneCard(cam, index, data) {
  const section = buildShell('Cylinder Zone', ICONS.zone, '<span class="badge badge-present">Monitoring</span>', `CAM-${String(index + 1).padStart(2, '0')}`, cam.videoUrl);
  const right = section.querySelector('#right-panel');
  right.innerHTML = `
    <div class="kpi-metric-label">People in Zone</div>
    <div class="kpi-metric-value" id="cz-people">--</div>
    <div class="kpi-metric-label">Current Dwell Time</div>
    <div class="kpi-metric-value" id="cz-dwell" style="font-size:1.6rem">00:00</div>
    <div class="kpi-metric-sub">MM:SS in zone</div>
    <div class="kpi-metric-label">Completed Visits</div>
    <div class="kpi-metric-value" id="cz-visits" style="font-size:1.5rem">0</div>`;

  if (!data) return section;
  const { rows } = data;

  const peopleEl = right.querySelector('#cz-people');
  const dwellEl  = right.querySelector('#cz-dwell');
  const visitsEl = right.querySelector('#cz-visits');
  const video = section.querySelector('.kpi-video');

  function update() {
    if (!rows.length) return;
    const idx = Math.min(Math.floor(video.currentTime || 0), rows.length - 1);
    const row = rows[idx];
    peopleEl.textContent = String(row.people_in_zone);
    dwellEl.textContent  = formatSecs(row.current_dwell_secs);
    visitsEl.textContent = String(row.completed_visit_count);
  }
  video.addEventListener('loadedmetadata', update);
  video.addEventListener('timeupdate', update);
  return section;
}

// ── 7. Table Clearance ─────────────────────────────────────────────────────
export function buildTableClearanceCard(cam, index, data) {
  const section = buildShell('Table Clearance', ICONS.table, '<span class="badge badge-present">Monitoring</span>', `CAM-${String(index + 1).padStart(2, '0')}`, cam.videoUrl);
  const right = section.querySelector('#right-panel');
  right.innerHTML = `
    <div class="kpi-metric-label">Table States</div>
    <div class="table-state-grid">
      <div class="table-cell" id="tc-t1"><div class="table-cell-label">Table 1</div><div class="table-cell-state">--</div><div class="table-cell-secs"></div></div>
      <div class="table-cell" id="tc-t2"><div class="table-cell-label">Table 2</div><div class="table-cell-state">--</div><div class="table-cell-secs"></div></div>
      <div class="table-cell" id="tc-t3"><div class="table-cell-label">Table 3</div><div class="table-cell-state">--</div><div class="table-cell-secs"></div></div>
      <div class="table-cell" id="tc-t4"><div class="table-cell-label">Table 4</div><div class="table-cell-state">--</div><div class="table-cell-secs"></div></div>
    </div>
    <div class="kpi-metric-label" style="margin-top:10px">Alert</div>
    <div class="badge-row" id="tc-alert-badge"></div>`;

  if (!data) return section;
  const { rows } = data;

  const cells = [
    right.querySelector('#tc-t1'),
    right.querySelector('#tc-t2'),
    right.querySelector('#tc-t3'),
    right.querySelector('#tc-t4'),
  ];
  const alertBadge = right.querySelector('#tc-alert-badge');
  const video = section.querySelector('.kpi-video');

  function stateClass(state) {
    if (state === 'CLEAN') return 'state-clean';
    if (state === 'OCCUPIED') return 'state-occupied';
    if (state === 'UNCLEAN') return 'state-unclean';
    return '';
  }

  function update() {
    if (!rows.length) return;
    const idx = Math.min(Math.floor(video.currentTime || 0), rows.length - 1);
    const row = rows[idx];
    row.states.forEach((state, i) => {
      const cell = cells[i];
      const uncleanSecs = row.unclean_secs[i];
      const isAlert = state === 'UNCLEAN' && uncleanSecs >= 20;
      cell.className = `table-cell ${stateClass(state)}${isAlert ? ' state-alert' : ''}`;
      cell.querySelector('.table-cell-state').textContent = state || '--';
      cell.querySelector('.table-cell-secs').textContent =
        state === 'UNCLEAN' ? `Unclean: ${uncleanSecs}s` : '';
    });
    alertBadge.innerHTML = row.has_alert
      ? `<span class="badge badge-alert">Unclean &gt; 20s</span>`
      : `<span class="badge badge-ok">Clear</span>`;
  }
  video.addEventListener('loadedmetadata', update);
  video.addEventListener('timeupdate', update);
  return section;
}

// ── 7b. Table Clearance 2 (7 tables) ──────────────────────────────────────
export function buildTableClearance7Card(cam, index, data) {
  const section = buildShell('Table Clearance 2', ICONS.table, '<span class="badge badge-present">Monitoring</span>', `CAM-${String(index + 1).padStart(2, '0')}`, cam.videoUrl);
  const right = section.querySelector('#right-panel');
  right.innerHTML = `
    <div class="kpi-metric-label">Table States</div>
    <div class="table-state-grid-7">
      <div class="table-cell" id="tc2-t1"><div class="table-cell-label">Table 1</div><div class="table-cell-state">--</div><div class="table-cell-secs"></div></div>
      <div class="table-cell" id="tc2-t2"><div class="table-cell-label">Table 2</div><div class="table-cell-state">--</div><div class="table-cell-secs"></div></div>
      <div class="table-cell" id="tc2-t3"><div class="table-cell-label">Table 3</div><div class="table-cell-state">--</div><div class="table-cell-secs"></div></div>
      <div class="table-cell" id="tc2-t4"><div class="table-cell-label">Table 4</div><div class="table-cell-state">--</div><div class="table-cell-secs"></div></div>
      <div class="table-cell" id="tc2-t5"><div class="table-cell-label">Table 5</div><div class="table-cell-state">--</div><div class="table-cell-secs"></div></div>
      <div class="table-cell" id="tc2-t6"><div class="table-cell-label">Table 6</div><div class="table-cell-state">--</div><div class="table-cell-secs"></div></div>
      <div class="table-cell" id="tc2-t7"><div class="table-cell-label">Table 7</div><div class="table-cell-state">--</div><div class="table-cell-secs"></div></div>
    </div>
    <div class="kpi-metric-label" style="margin-top:10px">Alert</div>
    <div class="badge-row" id="tc2-alert-badge"></div>`;

  if (!data) return section;
  const { rows } = data;

  const cells = [
    right.querySelector('#tc2-t1'),
    right.querySelector('#tc2-t2'),
    right.querySelector('#tc2-t3'),
    right.querySelector('#tc2-t4'),
    right.querySelector('#tc2-t5'),
    right.querySelector('#tc2-t6'),
    right.querySelector('#tc2-t7'),
  ];
  const alertBadge = right.querySelector('#tc2-alert-badge');
  const video = section.querySelector('.kpi-video');

  function stateClass(state) {
    if (state === 'CLEAN')    return 'state-clean';
    if (state === 'OCCUPIED') return 'state-occupied';
    if (state === 'UNCLEAN')  return 'state-unclean';
    return '';
  }

  function update() {
    if (!rows.length) return;
    const idx = Math.min(Math.floor(video.currentTime || 0), rows.length - 1);
    const row = rows[idx];
    row.states.forEach((state, i) => {
      const cell = cells[i];
      const uncleanSecs = row.unclean_secs[i];
      const isAlert = state === 'UNCLEAN' && uncleanSecs >= 20;
      cell.className = `table-cell ${stateClass(state)}${isAlert ? ' state-alert' : ''}`;
      cell.querySelector('.table-cell-state').textContent = state || '--';
      cell.querySelector('.table-cell-secs').textContent = '';
    });
    alertBadge.innerHTML = row.has_alert
      ? `<span class="badge badge-alert">Unclean &gt; 20s</span>`
      : `<span class="badge badge-ok">Clear</span>`;
  }
  video.addEventListener('loadedmetadata', update);
  video.addEventListener('timeupdate', update);
  return section;
}

// ── 8. Food Safety Gear (Apron and Cap) ───────────────────────────────────
export function buildApronCard(cam, index, _data) {
  const section = buildShell('Food Safety Gear (Apron and Cap)', ICONS.apron,
    '<span class="badge badge-present">Active</span>',
    `CAM-${String(index + 1).padStart(2, '0')}`, cam.videoUrl);
  const right = section.querySelector('#right-panel');
  right.innerHTML = `
    <div class="kpi-metric-label">Bounding Box Legend</div>
    <table class="apron-legend-table">
      <thead><tr><th>Colour</th><th>Meaning</th></tr></thead>
      <tbody>
        <tr><td><span class="colour-dot colour-dot-green"></span> Green</td><td>All OK</td></tr>
        <tr><td><span class="colour-dot colour-dot-yellow"></span> Yellow</td><td>Partially compliant</td></tr>
        <tr><td><span class="colour-dot colour-dot-red"></span> Red</td><td>Non-compliant</td></tr>
      </tbody>
    </table>`;
  return section;
}

// ── Dashboard shell + render ───────────────────────────────────────────────
export async function renderDashboard(appEl, cameras, allData) {
  appEl.innerHTML = `
    <header class="dashboard-header">
      <div class="header-logo">
        <img src="/xenlogo.png" alt="XenReality" class="header-logo-img" />
      </div>
      <span class="header-brand-name">PoC Dashboard</span>
      <div class="header-right">
        <span class="header-status">SYSTEM ONLINE</span>
        <span class="header-clock" id="ist-clock">--:--:--</span>
      </div>
    </header>
    <main class="dashboard-main" id="kpi-main"></main>`;

  const clockEl = appEl.querySelector('#ist-clock');
  clockEl.textContent = formatISTTime();
  setInterval(() => { clockEl.textContent = formatISTTime(); }, 1000);

  const main = appEl.querySelector('#kpi-main');
  const builders = [
    buildCashStaffCard,
    buildPaymentCard,
    buildPayment2Card,
    buildCashierAbsenceCard,
    buildCustomerWaitCard,
    buildCashierPayoutCard,
    buildCylinderZoneCard,
    buildTableClearanceCard,
    buildTableClearance7Card,
    buildApronCard,
  ];
  const dataKeys = [
    'cashStaff', 'payment', 'payment2', 'cashierAbsence',
    'customerWait', 'cashierPayout', 'cylinderZone', 'tableClearance', 'tableClearance7', 'apron',
  ];

  cameras.forEach((cam, i) => {
    const card = builders[i](cam, i, allData ? allData[dataKeys[i]] : null);
    main.appendChild(card);
  });
}
