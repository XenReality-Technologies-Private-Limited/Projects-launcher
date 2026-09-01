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

/** Does this table have the column? Older published databases do not. */
function hasColumn(db, table, column) {
  try {
    const stmt = db.prepare(`PRAGMA table_info("${table}")`);
    let found = false;
    while (stmt.step()) {
      if (String(stmt.getAsObject().name).toLowerCase() === column.toLowerCase()) found = true;
    }
    stmt.free();
    return found;
  } catch {
    return false;
  }
}

export async function loadKitchenData(url) {
  const db = await fetchDb(url);

  // The pipeline records an employee count, but the published kitchen.db has
  // historically shipped only the four PPE columns. Use the real column when it
  // is there, and derive it when it is not, so this keeps working either way.
  const TABLE = 'chicking_kitchen_ppe_status';
  const hasEmployees = hasColumn(db, TABLE, 'employees');

  const stmt = db.prepare(
    'SELECT video_time, gloves_on, gloves_off, hairnet_on, hairnet_off' +
    (hasEmployees ? ', employees' : '') +
    ` FROM ${TABLE} ORDER BY video_time ASC`
  );
  const rows = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    const gloves_on   = Number(r.gloves_on)   || 0;
    const gloves_off  = Number(r.gloves_off)  || 0;
    const hairnet_on  = Number(r.hairnet_on)  || 0;
    const hairnet_off = Number(r.hairnet_off) || 0;

    // Every employee in frame lands in exactly one of the glove buckets and one
    // of the hairnet buckets, so either pair sums to the headcount. They can
    // disagree by one when an item is unclear on somebody and that person is
    // dropped from one pair but not the other, so take the larger — it is the
    // count that accounts for every person seen.
    const derived = Math.max(gloves_on + gloves_off, hairnet_on + hairnet_off);

    rows.push({
      timeSeconds: parseHMSToSeconds(r.video_time),
      gloves_on, gloves_off, hairnet_on, hairnet_off,
      employees: hasEmployees ? (Number(r.employees) || 0) : derived,
      employeesDerived: !hasEmployees,
    });
  }
  stmt.free();
  db.close();
  return { kitchenRows: rows };
}

// ── bill_wait.db ────────────────────────────────────────────────────────────
export async function loadBillWaitData(url) {
  const db = await fetchDb(url);

  // Billing occupancy over time, one row per change.
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

  // One row per completed transaction: how long it took, and the moment it finished.
  // The moment is what lets the dashboard show a mean over the transactions done SO FAR
  // rather than a whole-session figure from the start of playback.
  //
  // These are NOT inferred from drops in billing_count. That derivation measured the gap
  // between two table rows divided by how many people left, which is a property of the
  // sampling interval and not of how long anybody stood at the till.
  const serviceEvents = [];
  try {
    const svcStmt = db.prepare(
      'SELECT video_time, service_seconds FROM billing_services ORDER BY video_time ASC'
    );
    while (svcStmt.step()) {
      const r = svcStmt.getAsObject();
      const d = Number(r.service_seconds);
      if (Number.isFinite(d) && d > 0) {
        serviceEvents.push({ timeSeconds: parseHMSToSeconds(r.video_time), duration: d });
      }
    }
    svcStmt.free();
  } catch {
    // An older bill_wait.db has no such table; the tile then just stays at "—".
  }

  db.close();
  return { billingRows, serviceEvents };
}
