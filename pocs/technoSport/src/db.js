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

function n(val) { return Number(val) || 0; }

export function parseCount(val) {
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed.map(Number);
    return [Number(parsed) || 0, 0, 0];
  } catch {
    return [0, 0, 0];
  }
}

function sumCount(val) {
  return parseCount(val).reduce((a, b) => a + b, 0);
}

// FIFO dwell time calculation:
// For each row, compute deltas in entries/exits, maintain a FIFO queue of
// entry times, pop on exit to get per-person dwell, track running average.
function computeFifoDwellMinutes(rows) {
  const dwellAtIndex = [];
  const queue = [];
  let prevIn = 0;
  let prevOut = 0;
  let totalDwell = 0;
  let totalExits = 0;

  for (let i = 0; i < rows.length; i++) {
    const inTotal = sumCount(rows[i].in_count);
    const outTotal = sumCount(rows[i].out_count);

    const deltaIn = Math.max(0, inTotal - prevIn);
    const deltaOut = Math.max(0, outTotal - prevOut);

    for (let j = 0; j < deltaIn; j++) queue.push(i);

    for (let j = 0; j < deltaOut; j++) {
      if (queue.length > 0) {
        const entryIdx = queue.shift();
        totalDwell += (i - entryIdx);
        totalExits++;
      }
    }

    prevIn = inTotal;
    prevOut = outTotal;
    dwellAtIndex.push(totalExits > 0 ? totalDwell / totalExits : 0);
  }

  return dwellAtIndex;
}

function queryTable(db, tableName) {
  const rows = [];
  try {
    const stmt = db.prepare(`SELECT * FROM "${tableName}" ORDER BY id ASC`);
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
  } catch (e) {
    console.warn(`Could not query table "${tableName}":`, e.message);
  }
  return rows;
}

export async function loadDB(url) {
  const SQL = await getSqlInstance();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cannot load database (${response.status}).`);
  const buffer = await response.arrayBuffer();
  const db = new SQL.Database(new Uint8Array(buffer));

  const passerby      = queryTable(db, 'passerby');
  const footfallGround = queryTable(db, 'footfall_ground');
  const footfallFirst  = queryTable(db, 'footfall_first');
  const greetings     = queryTable(db, 'greetings');
  const billing       = queryTable(db, 'billing');

  db.close();

  const gfDwellTimes = computeFifoDwellMinutes(footfallGround);
  const ffDwellTimes = computeFifoDwellMinutes(footfallFirst);

  // Billing count: count each time customer_present transitions 0→1 (new arrival).
  // This is more reliable than customer_count which doesn't always reset between customers.
  const billingCumMax = [];
  let billingCumTotal = 0;
  let billingPrevPresent = 0;
  for (const row of billing) {
    const curr = n(row.customer_present);
    if (curr === 1 && billingPrevPresent === 0) billingCumTotal++;
    billingPrevPresent = curr;
    billingCumMax.push(billingCumTotal);
  }

  // Max values for normalization
  const maxPasserbyIn = passerby.reduce((m, r) => Math.max(m, sumCount(r.in_count)), 0);
  const maxGfIn       = footfallGround.reduce((m, r) => Math.max(m, sumCount(r.in_count)), 0);
  const maxBilling    = Math.max(billingCumTotal, 1);
  const maxEmpTime    = billing.reduce((m, r) => Math.max(m, n(r.employee_time_seconds)), 0);
  const maxInteract   = billing.reduce((m, r) => Math.max(m, n(r.interaction_time_seconds)), 0);

  return {
    passerby,
    footfallGround,
    footfallFirst,
    greetings,
    billing,
    billingCumMax,
    gfDwellTimes,
    ffDwellTimes,
    maxPasserbyIn,
    maxGfIn,
    maxBilling,
    maxEmpTime,
    maxInteract,
  };
}
