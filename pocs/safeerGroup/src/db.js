import initSqlJs from 'sql.js';

const CF = 'https://d2uimaqek2eby3.cloudfront.net/Safeer';

let _sqlPromise = null;
function getSql() {
  if (!_sqlPromise) {
    _sqlPromise = initSqlJs({
      locateFile: f => `https://cdn.jsdelivr.net/npm/sql.js@1.14.0/dist/${f}`,
    });
  }
  return _sqlPromise;
}

async function loadEvents(dbUrl) {
  const SQL = await getSql();
  const res = await fetch(dbUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status} loading ${dbUrl}`);
  const buf = await res.arrayBuffer();
  const db  = new SQL.Database(new Uint8Array(buf));
  const result = db.exec('SELECT time, time_seconds, scanned FROM events ORDER BY time_seconds');
  db.close();
  if (!result[0]) return [];
  return result[0].values.map(([time, time_seconds, scanned]) => ({
    time,
    time_seconds: Number(time_seconds),
    scanned: scanned === 1,
  }));
}

export async function loadAllData() {
  const [cam1, cam2] = await Promise.all([
    loadEvents(`${CF}/events.db`),
    loadEvents(`${CF}/events_2.db`),
  ]);
  return { cam1, cam2 };
}
