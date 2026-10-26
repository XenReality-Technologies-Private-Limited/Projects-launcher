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

// ── RasoiKing.db ───────────────────────────────────────────────────────────
//
// Only truck_presence is read here. The database also has tin_count /
// tin_events / truck_sessions tables for oil-can tracking, but the customer
// hasn't finalized that data source yet — those will be wired in once
// confirmed, so the Oil Cans Loaded card stays a placeholder for now.
export async function loadTruckPresenceData(url) {
  const db = await fetchDb(url);

  const stmt = db.prepare(
    'SELECT video_time, wall_time, present FROM truck_presence ORDER BY video_time ASC'
  );
  const rows = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    rows.push({
      timeSeconds: parseHMSToSeconds(r.video_time),
      wallTime: r.wall_time,
      present: Number(r.present) ? 1 : 0,
    });
  }
  stmt.free();
  db.close();
  return { truckRows: rows };
}
