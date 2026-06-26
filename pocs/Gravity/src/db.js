import initSqlJs from 'sql.js';

let _sqlPromise = null;
function getSql() {
  if (!_sqlPromise) {
    _sqlPromise = initSqlJs({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/sql.js@1.14.0/dist/${file}`,
    });
  }
  return _sqlPromise;
}

export async function createDatabase(url) {
  const SQL = await getSql();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch database: ${res.status} ${res.statusText}`);
  const buf = await res.arrayBuffer();
  return new SQL.Database(new Uint8Array(buf));
}

export function loadStoreEntrance(db) {
  const stmt = db.prepare('SELECT timestamp, male, female, child FROM store_entrance ORDER BY rowid ASC');
  const rows = [], maleSeries = [], femaleSeries = [], childSeries = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    const male = Number(r.male) || 0, female = Number(r.female) || 0, child = Number(r.child) || 0;
    rows.push({ timestamp: r.timestamp, male, female, child });
    maleSeries.push(male);
    femaleSeries.push(female);
    childSeries.push(child);
  }
  stmt.free();
  return { rows, maleSeries, femaleSeries, childSeries };
}

export function loadZoneDwellTime(db) {
  const stmt = db.prepare('SELECT timestamp, people_in_zone, total_dwell_time_s FROM zone_dwell_time ORDER BY rowid ASC');
  const rows = [], peopleSeries = [], dwellSeries = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    const people = Number(r.people_in_zone) || 0, dwell = Number(r.total_dwell_time_s) || 0;
    rows.push({ timestamp: r.timestamp, people_in_zone: people, total_dwell_time_s: dwell });
    peopleSeries.push(people);
    dwellSeries.push(dwell);
  }
  stmt.free();
  return { rows, peopleSeries, dwellSeries };
}

export function loadVestCompliance(db) {
  const stmt = db.prepare('SELECT timestamp, total_alerts FROM vest_compliance_alert ORDER BY rowid ASC');
  const rows = [], alertSeries = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    const alerts = Number(r.total_alerts) || 0;
    rows.push({ timestamp: r.timestamp, total_alerts: alerts });
    alertSeries.push(alerts);
  }
  stmt.free();
  return { rows, alertSeries };
}
