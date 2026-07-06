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
  // DB format is MM:SS:FF (minutes:seconds:frames), not HH:MM:SS
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

  const passerbyRaw = queryTableByTime(db, 'passerby');
  const footfallRaw = queryTableByTime(db, 'footfall');
  const empIntRaw   = queryTableByTime(db, 'employee_interactions');
  db.close();

  const passerby = passerbyRaw.map(r => ({
    t:   hmsToSeconds(r.video_time),
    in:  parseCount(r.in_count),
    out: parseCount(r.out_count),
  }));

  const footfall = footfallRaw.map(r => ({
    t:   hmsToSeconds(r.video_time),
    in:  parseCount(r.in_count),
    out: parseCount(r.out_count),
  }));

  const empInteractions = empIntRaw.map(r => ({
    t:                   hmsToSeconds(r.video_time),
    employeePresent:     Number(r.employee_present) || 0,
    customerPresent:     Number(r.customer_present) || 0,
    customerCount:       Number(r.customer_count) || 0,
    employeeCount:       Number(r.employee_count) || 0,
    employeeTimeSecs:    Math.floor(Number(r.employee_time_seconds) || 0),
    interactionTimeSecs: Math.floor(Number(r.interaction_time_seconds) || 0),
  }));

  return { passerby, footfall, empInteractions };
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
