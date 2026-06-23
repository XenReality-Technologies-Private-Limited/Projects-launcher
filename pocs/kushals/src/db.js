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

export async function loadDB(primaryUrl, jcUrl) {
  const SQL = await getSqlInstance();

  const [primaryResp, jcResp] = await Promise.all([fetch(primaryUrl), fetch(jcUrl)]);
  if (!primaryResp.ok) throw new Error(`Cannot load primary database (${primaryResp.status}).`);
  if (!jcResp.ok)      throw new Error(`Cannot load JC database (${jcResp.status}).`);

  const [primaryBuf, jcBuf] = await Promise.all([primaryResp.arrayBuffer(), jcResp.arrayBuffer()]);

  const db   = new SQL.Database(new Uint8Array(primaryBuf));
  const jcDb = new SQL.Database(new Uint8Array(jcBuf));

  const passerby       = queryTable(db,   'passerby');
  const footfall       = queryTable(db,   'footfall');
  const greetings      = queryTable(db,   'greetings');
  const totalEmployees = queryTable(db,   'total_employees');
  const jewelleryClr   = queryTable(jcDb, 'jewellery_clearance');

  db.close();
  jcDb.close();

  const ftDwellTimes = computeFifoDwellMinutes(footfall);

  // Cumulative seconds where both employee AND customer are present simultaneously
  const bothPresentCum = [];
  let cumBoth = 0;
  for (const row of jewelleryClr) {
    if (n(row.customer_present) === 1 && n(row.employee_present) === 1) cumBoth++;
    bothPresentCum.push(cumBoth);
  }

  const maxPasserbyIn    = passerby.reduce((m, r) => Math.max(m, sumCount(r.in_count)), 0);
  const maxFootfallIn    = footfall.reduce((m, r) => Math.max(m, sumCount(r.in_count)), 0);
  const maxEmpCount      = totalEmployees.reduce((m, r) => Math.max(m, n(r.employee_count)), 0);
  const maxBothPresent   = Math.max(cumBoth, 1);

  return {
    passerby,
    footfall,
    greetings,
    totalEmployees,
    jewelleryClr,
    ftDwellTimes,
    bothPresentCum,
    maxPasserbyIn,
    maxFootfallIn,
    maxEmpCount,
    maxBothPresent,
  };
}
