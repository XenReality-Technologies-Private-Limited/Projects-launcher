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

function parseCount(val) {
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed.map(Number);
    return [Number(parsed) || 0, 0, 0];
  } catch {
    return [0, 0, 0];
  }
}

function hmsToSeconds(hms) {
  // Format is MM:SS:FF — take minutes * 60 + seconds, ignore frames
  const parts = String(hms).split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

function queryTableByTime(db, tableName) {
  const rows = [];
  try {
    const stmt = db.prepare(`SELECT * FROM "${tableName}" ORDER BY video_time ASC`);
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
  } catch (e) {
    console.warn(`Could not query table "${tableName}":`, e.message);
  }
  return rows;
}

export async function loadDB(dbUrl) {
  const SQL = await getSqlInstance();
  const resp = await fetch(dbUrl);
  if (!resp.ok) throw new Error(`Cannot load database (${resp.status}).`);
  const buf = await resp.arrayBuffer();
  const db = new SQL.Database(new Uint8Array(buf));

  const footfallRaw = queryTableByTime(db, 'footfall');
  const billingRaw  = queryTableByTime(db, 'billing');
  db.close();

  const footfall = footfallRaw.map(r => ({
    t:   hmsToSeconds(r.video_time),
    in:  parseCount(r.in_count),
    out: parseCount(r.out_count),
  }));

  const billing = billingRaw.map(r => ({
    t:                   hmsToSeconds(r.video_time),
    employeePresent:     Number(r.employee_present) === 1 || r.employee_present === 'true',
    customerCount:       Number(r.customer_count) || 0,
    employeeTimeSecs:    Math.floor(Number(r.employee_time_seconds) || 0),
    interactionTimeSecs: Math.floor(Number(r.interaction_time_seconds) || 0),
  }));

  return { footfall, billing };
}

export function findRow(rows, currentTime) {
  if (!rows.length) return null;
  let result = rows[0];
  for (const row of rows) {
    if (row.t <= currentTime) result = row;
    else break;
  }
  return result;
}
