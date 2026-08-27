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
