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

  const events = [];

  // SQLite guarantees that for MIN(), other bare columns come from the same row
  const stmt = db.prepare(
    'SELECT person_id, returning, MIN(time) AS time, frontal_image_base64 ' +
    'FROM person_visits ' +
    'GROUP BY person_id, returning ' +
    'ORDER BY time ASC'
  );

  while (stmt.step()) {
    const r = stmt.getAsObject();
    events.push({
      time:      Number(r.time),
      person_id: Number(r.person_id),
      returning: Number(r.returning),
      image:     r.frontal_image_base64 ? `data:image/jpeg;base64,${r.frontal_image_base64}` : null,
    });
  }
  stmt.free();
  db.close();

  events.sort((a, b) => a.time - b.time);

  const firstSeenMap = new Map();
  for (const e of events) {
    if (e.returning === 0 && !firstSeenMap.has(e.person_id)) {
      firstSeenMap.set(e.person_id, e.time);
    }
  }

  return { events, firstSeenMap };
}
