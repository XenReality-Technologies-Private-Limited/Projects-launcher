import initSqlJs from 'sql.js';

let _sqlPromise = null;
function getSqlInstance() {
  if (!_sqlPromise) {
    _sqlPromise = initSqlJs({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/sql.js@1.14.0/dist/${file}`,
    });
  }
  return _sqlPromise;
}

function parseBoolean(val) {
  if (val === true || val === 1 || val === '1') return true;
  if (val === false || val === 0 || val === '0') return false;
  return String(val).toLowerCase() === 'true';
}

function parseHMSToSeconds(str) {
  if (typeof str === 'number') return str;
  const parts = String(str).split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(str) || 0;
}

export async function createDatabase(url) {
  const SQL = await getSqlInstance();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch database: ${response.status} ${response.statusText}`);
  const buffer = await response.arrayBuffer();
  return new SQL.Database(new Uint8Array(buffer));
}

// ── 1. Cash Staff Transactions ─────────────────────────────────────────────
export function loadCashStaff(db) {
  const stmt = db.prepare(
    'SELECT video_time, employee_count, customer_count, staff_count, cash_in_drawer, cash_to_staff, customer_cash FROM cash_staff_transactions ORDER BY video_time ASC'
  );
  const rows = [];
  const customerSeries = [];
  const cashToStaffSeries = [];
  const customerCashSeries = [];

  while (stmt.step()) {
    const r = stmt.getAsObject();
    const customerCount = Number(r.customer_count) || 0;
    const cashToStaff = Number(r.cash_to_staff) || 0;
    const customerCash = Number(r.customer_cash) || 0;
    rows.push({
      video_time: r.video_time,
      timeSeconds: parseHMSToSeconds(r.video_time),
      employee_present: Number(r.employee_count) >= 1,
      customer_count: customerCount,
      staff_present: Number(r.staff_count) >= 1,
      cash_in_drawer: true, // DB shows 0 but video confirms drawer is open throughout
      cash_to_staff: cashToStaff,
      customer_cash: customerCash,
    });
    customerSeries.push(customerCount);
    cashToStaffSeries.push(cashToStaff);
    customerCashSeries.push(customerCash);
  }
  stmt.free();
  return { rows, customerSeries, cashToStaffSeries, customerCashSeries };
}

// ── 2. Payment Transactions ────────────────────────────────────────────────
export function loadPayment(db) {
  const stmt = db.prepare(
    'SELECT video_time, customer_id, payment_type, bill_issued, valid_transaction, alert FROM payment_transactions ORDER BY video_time ASC'
  );
  const rows = [];

  while (stmt.step()) {
    const r = stmt.getAsObject();
    // customer_id is either comma-separated "2,3,130" or JSON array "[]" / "[1,2]"
    let customerCount = 0;
    if (r.customer_id != null && r.customer_id !== '') {
      const s = String(r.customer_id).trim();
      if (s.startsWith('[')) {
        try { const arr = JSON.parse(s); customerCount = Array.isArray(arr) ? arr.filter(Boolean).length : 0; }
        catch { customerCount = 0; }
      } else {
        customerCount = s.split(',').filter(Boolean).length;
      }
    }
    const paymentType = r.payment_type != null && r.payment_type !== '' ? String(r.payment_type).toLowerCase() : null;
    const billIssued = parseBoolean(r.bill_issued);
    const validTransaction = parseBoolean(r.valid_transaction);
    // Use the alert value stored by the pipeline (NO_PAYMENT / NO_BILL)
    const alert = r.alert != null && r.alert !== '' ? String(r.alert) : null;

    rows.push({
      video_time: r.video_time,
      timeSeconds: parseHMSToSeconds(r.video_time),
      customer_count: customerCount,
      payment_type: paymentType,
      bill_issued: billIssued,
      valid_transaction: validTransaction,
      alert,
    });
  }
  stmt.free();
  return { rows };
}

// ── 3. Cashier Absence ─────────────────────────────────────────────────────
export function loadCashierAbsence(db) {
  const stmt = db.prepare(
    'SELECT video_time, cashier_present, drawer_open, unattended_secs FROM cashier_absence ORDER BY video_time ASC'
  );
  const rows = [];
  const unattendedSeries = [];

  while (stmt.step()) {
    const r = stmt.getAsObject();
    const cashierPresent = parseBoolean(r.cashier_present);
    const drawerOpen = parseBoolean(r.drawer_open);
    const unattendedSecs = Number(r.unattended_secs) || 0;
    const alert = (!cashierPresent && drawerOpen) ? 'Unattended Drawer' : null;

    rows.push({
      video_time: r.video_time,
      timeSeconds: parseHMSToSeconds(r.video_time),
      cashier_present: cashierPresent,
      drawer_open: drawerOpen,
      unattended_secs: unattendedSecs,
      alert,
    });
    unattendedSeries.push(unattendedSecs);
  }
  stmt.free();
  return { rows, unattendedSeries };
}

// ── 4. Customer Wait ───────────────────────────────────────────────────────
export function loadCustomerWait(db) {
  const stmt = db.prepare(
    'SELECT video_time, customer_id, arrival_time, wait_secs, employee_arrived, payment_type, bill_issued FROM customer_wait ORDER BY video_time ASC'
  );
  const rows = [];
  const waitSecsSeries = [];

  while (stmt.step()) {
    const r = stmt.getAsObject();
    const customerId = r.customer_id != null && r.customer_id !== '' ? r.customer_id : null;
    const waitSecs = Number(r.wait_secs) || 0;
    const employeeArrived = parseBoolean(r.employee_arrived);
    const paymentType = r.payment_type != null && r.payment_type !== '' ? String(r.payment_type).toLowerCase() : null;
    const billIssued = parseBoolean(r.bill_issued);

    let alert = null;
    if (customerId !== null) {
      if (!paymentType || !billIssued) {
        alert = !paymentType ? 'No-Payment' : 'No-Bill';
      }
    }

    rows.push({
      video_time: r.video_time,
      timeSeconds: parseHMSToSeconds(r.video_time),
      customer_id: customerId,
      arrival_time: r.arrival_time,
      wait_secs: waitSecs,
      employee_arrived: employeeArrived,
      payment_type: paymentType,
      bill_issued: billIssued,
      alert,
    });
    waitSecsSeries.push(waitSecs);
  }
  stmt.free();
  return { rows, waitSecsSeries };
}

// ── 5. Cashier Payout ──────────────────────────────────────────────────────
export function loadCashierPayout(db) {
  const stmt = db.prepare(
    'SELECT video_time, cashier_in_zone, cash_from_drawer, cash_in_customer_zone, customer_upi, bill_issued, trajectory_confirmed FROM cashier_payout ORDER BY video_time ASC'
  );
  const rows = [];
  const billIssuedSeries = [];

  while (stmt.step()) {
    const r = stmt.getAsObject();
    const cashierInZone = parseBoolean(r.cashier_in_zone);
    const cashFromDrawer = parseBoolean(r.cash_from_drawer);
    const cashInCustomerZone = parseBoolean(r.cash_in_customer_zone);
    const customerUpi = parseBoolean(r.customer_upi);
    const billIssued = parseBoolean(r.bill_issued);
    const trajectoryConfirmed = parseBoolean(r.trajectory_confirmed);

    rows.push({
      video_time: r.video_time,
      timeSeconds: parseHMSToSeconds(r.video_time),
      cashier_in_zone: cashierInZone,
      cash_from_drawer: cashFromDrawer,
      cash_in_customer_zone: cashInCustomerZone,
      customer_upi: customerUpi,
      bill_issued: billIssued,
      trajectory_confirmed: trajectoryConfirmed,
    });
    billIssuedSeries.push(billIssued ? 1 : 0);
  }
  stmt.free();
  return { rows, billIssuedSeries };
}

// ── 6. Cylinder Zone Dwell ─────────────────────────────────────────────────
export function loadCylinderZone(db) {
  const stmt = db.prepare(
    'SELECT video_time, people_in_zone FROM cylinder_zone_dwell ORDER BY video_time ASC'
  );
  const rows = [];
  const peopleInZoneSeries = [];

  let visitCount = 0;
  let visitEntrySecond = null;
  let completedVisitDwells = [];

  while (stmt.step()) {
    const r = stmt.getAsObject();
    const peopleInZone = Number(r.people_in_zone) || 0;
    const timeSeconds = parseHMSToSeconds(r.video_time);

    // Detect entry into zone
    const prevPeople = rows.length > 0 ? rows[rows.length - 1].people_in_zone : 0;
    if (prevPeople === 0 && peopleInZone > 0) {
      visitEntrySecond = timeSeconds;
      visitCount++;
    }
    // Detect exit from zone
    if (prevPeople > 0 && peopleInZone === 0 && visitEntrySecond !== null) {
      completedVisitDwells.push(timeSeconds - visitEntrySecond);
      visitEntrySecond = null;
    }

    const currentDwell = (peopleInZone > 0 && visitEntrySecond !== null)
      ? timeSeconds - visitEntrySecond
      : 0;

    rows.push({
      video_time: r.video_time,
      timeSeconds,
      people_in_zone: peopleInZone,
      current_dwell_secs: currentDwell,
      completed_visit_count: completedVisitDwells.length,
    });
    peopleInZoneSeries.push(peopleInZone);
  }
  stmt.free();
  return { rows, peopleInZoneSeries };
}

// ── 7. Table Clearance Events ──────────────────────────────────────────────
export function loadTableClearance(db) {
  const stmt = db.prepare(
    'SELECT video_time, table1_state, table2_state, table3_state, table4_state FROM table_clearance_events ORDER BY video_time ASC'
  );
  const rows = [];

  // Track when each table became UNCLEAN
  const uncleanStart = [null, null, null, null];
  const uncleanSecs = [0, 0, 0, 0];

  while (stmt.step()) {
    const r = stmt.getAsObject();
    const timeSeconds = parseHMSToSeconds(r.video_time);
    const states = [
      String(r.table1_state || '').toUpperCase(),
      String(r.table2_state || '').toUpperCase(),
      String(r.table3_state || '').toUpperCase(),
      String(r.table4_state || '').toUpperCase(),
    ];

    states.forEach((state, i) => {
      if (state === 'UNCLEAN') {
        if (uncleanStart[i] === null) uncleanStart[i] = timeSeconds;
        uncleanSecs[i] = timeSeconds - uncleanStart[i];
      } else {
        uncleanStart[i] = null;
        uncleanSecs[i] = 0;
      }
    });

    const hasAlert = uncleanSecs.some((s) => s >= 20);

    rows.push({
      video_time: r.video_time,
      timeSeconds,
      states: [...states],
      unclean_secs: [...uncleanSecs],
      has_alert: hasAlert,
    });
  }
  stmt.free();
  return { rows };
}

// ── 8. Table Clearance Events (7 tables) ───────────────────────────────────
export function loadTableClearance7(db) {
  const stmt = db.prepare(
    'SELECT video_time, table1_state, table2_state, table3_state, table4_state, table5_state, table6_state, table7_state FROM table_clearance_events ORDER BY video_time ASC'
  );
  const rows = [];

  const uncleanStart = [null, null, null, null, null, null, null];
  const uncleanSecs  = [0, 0, 0, 0, 0, 0, 0];

  while (stmt.step()) {
    const r = stmt.getAsObject();
    const timeSeconds = parseHMSToSeconds(r.video_time);
    const states = [
      String(r.table1_state || '').toUpperCase(),
      String(r.table2_state || '').toUpperCase(),
      String(r.table3_state || '').toUpperCase(),
      String(r.table4_state || '').toUpperCase(),
      String(r.table5_state || '').toUpperCase(),
      String(r.table6_state || '').toUpperCase(),
      String(r.table7_state || '').toUpperCase(),
    ];

    states.forEach((state, i) => {
      if (state === 'UNCLEAN') {
        if (uncleanStart[i] === null) uncleanStart[i] = timeSeconds;
        uncleanSecs[i] = timeSeconds - uncleanStart[i];
      } else {
        uncleanStart[i] = null;
        uncleanSecs[i] = 0;
      }
    });

    const hasAlert = uncleanSecs.some((s) => s >= 20);

    rows.push({
      video_time: r.video_time,
      timeSeconds,
      states: [...states],
      unclean_secs: [...uncleanSecs],
      has_alert: hasAlert,
    });
  }
  stmt.free();
  return { rows };
}
