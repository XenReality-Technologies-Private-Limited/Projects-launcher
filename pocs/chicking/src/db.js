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

function parseHMSToSeconds(str) {
  if (typeof str === 'number') return str;
  const parts = String(str).split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(str) || 0;
}

async function fetchDb(url) {
  const SQL      = await getSqlInstance();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
  const buffer = await response.arrayBuffer();
  return new SQL.Database(new Uint8Array(buffer));
}

// ── kitchen.db ─────────────────────────────────────────────────────────────
export async function loadKitchenData(url) {
  const db   = await fetchDb(url);
  const stmt = db.prepare(
    'SELECT video_time, gloves_on, gloves_off, hairnet_on, hairnet_off ' +
    'FROM chicking_kitchen_ppe_status ORDER BY video_time ASC'
  );
  const rows = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    rows.push({
      timeSeconds: parseHMSToSeconds(r.video_time),
      gloves_on:   Number(r.gloves_on)   || 0,
      gloves_off:  Number(r.gloves_off)  || 0,
      hairnet_on:  Number(r.hairnet_on)  || 0,
      hairnet_off: Number(r.hairnet_off) || 0,
    });
  }
  stmt.free();
  db.close();
  return { kitchenRows: rows };
}

// ── bill_wait.db ────────────────────────────────────────────────────────────
export async function loadBillWaitData(url) {
  const db = await fetchDb(url);

  // billing table
  const billingStmt = db.prepare(
    'SELECT video_time, billing_count FROM billing ORDER BY video_time ASC'
  );
  const billingRows = [];
  while (billingStmt.step()) {
    const r = billingStmt.getAsObject();
    billingRows.push({
      timeSeconds:   parseHMSToSeconds(r.video_time),
      billing_count: Number(r.billing_count) || 0,
    });
  }
  billingStmt.free();

  // waiting table
  const waitStmt = db.prepare(
    'SELECT video_time, waiting_count FROM waiting ORDER BY video_time ASC'
  );
  const waitingRows = [];
  while (waitStmt.step()) {
    const r = waitStmt.getAsObject();
    waitingRows.push({
      timeSeconds:   parseHMSToSeconds(r.video_time),
      waiting_count: Number(r.waiting_count) || 0,
    });
  }
  waitStmt.free();
  db.close();

  // Pre-calculate avg billing time from queue reductions
  // Each time billing_count drops, the service duration = time since last change
  const avgBillingTime = calcAvgBillingTime(billingRows);

  return { billingRows, waitingRows, avgBillingTime };
}

function calcAvgBillingTime(rows) {
  if (rows.length < 2) return 0;
  const durations = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const curr = rows[i];
    const drop = prev.billing_count - curr.billing_count;
    if (drop > 0) {
      const duration = curr.timeSeconds - prev.timeSeconds;
      // If multiple people served at once, split duration evenly
      for (let d = 0; d < drop; d++) {
        durations.push(duration / drop);
      }
    }
  }
  if (!durations.length) return 0;
  return durations.reduce((a, b) => a + b, 0) / durations.length;
}
