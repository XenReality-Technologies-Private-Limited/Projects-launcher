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

export async function loadData(url) {
  const SQL = await getSqlInstance();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching database`);
  const buffer = await response.arrayBuffer();
  const db = new SQL.Database(new Uint8Array(buffer));

  // One event per (person_id, is_returning) pair — first occurrence by time.
  // This gives us: when each person was first seen, and when first seen as returning.
  const events = [];

  const stmt = db.prepare(
    'SELECT person_id, is_returning, MIN(time_seconds) AS time_seconds ' +
    'FROM face_detections ' +
    'GROUP BY person_id, is_returning ' +
    'ORDER BY time_seconds ASC'
  );

  while (stmt.step()) {
    const r = stmt.getAsObject();
    events.push({
      time:         Number(r.time_seconds),
      person_id:    Number(r.person_id),
      is_returning: Number(r.is_returning),
    });
  }
  stmt.free();
  db.close();

  events.sort((a, b) => a.time - b.time);

  // Pre-build a lookup: person_id → first-seen time (is_returning=0 row)
  const firstSeenMap = new Map();
  for (const e of events) {
    if (e.is_returning === 0 && !firstSeenMap.has(e.person_id)) {
      firstSeenMap.set(e.person_id, e.time);
    }
  }

  return { events, firstSeenMap };
}
