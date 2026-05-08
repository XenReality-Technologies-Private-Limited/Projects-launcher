import initSqlJs from 'sql.js';

// Singleton promise so WASM is compiled only once even when multiple KPI DBs load in parallel.
let _sqlPromise = null;
function getSqlInstance() {
  if (!_sqlPromise) {
    _sqlPromise = initSqlJs({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/sql.js@1.14.0/dist/${file}`,
    });
  }
  return _sqlPromise;
}

// Parses a JSON array string or comma-separated string into an array of numbers.
function parseNumberArray(str) {
  if (str == null || str === '') return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed.map(Number) : [];
  } catch {
    return String(str).split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));
  }
}

// Parses a JSON array string or comma-separated string into an array (e.g. customer_id or unique_customer).
function parseArray(str) {
  if (str == null || str === '') return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(str).split(',').map((s) => s.trim()).filter(Boolean);
  }
}

// [male, female, child] from in_count; ensures length 3.
function parseInCount(str) {
  const arr = parseNumberArray(str);
  const male = arr[0] ?? 0;
  const female = arr[1] ?? 0;
  const child = arr[2] ?? 0;
  return [male, female, child];
}

function parseBoolean(val) {
  if (val === true || val === 1 || val === '1') return true;
  if (val === false || val === 0 || val === '0') return false;
  return String(val).toLowerCase() === 'true';
}

async function createDatabase(url = '/reliance.db') {
  const SQL = await getSqlInstance();

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch database: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return new SQL.Database(bytes);
}

function computeFIFODwell(rows) {
  const queues = [[], [], []]; // [male, female, child]
  let dwellSum = 0;
  let dwellCount = 0;

  rows.forEach((row, t) => {
    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < row.in_count[c]; i++) queues[c].push(t);
    }
    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < row.out_count[c]; i++) {
        if (queues[c].length > 0) {
          const entryTime = queues[c].shift();
          const raw = t - entryTime;
          const rounded = Math.round(raw / 30) * 30;
          const clamped = Math.max(30, Math.min(3600, rounded));
          dwellSum += clamped;
          dwellCount++;
        }
      }
    }
    row.avg_dwell_time = dwellCount > 0 ? dwellSum / dwellCount : 0;
  });
}

function loadFootfall(db) {
  const stmt = db.prepare('SELECT video_time, in_count, out_count FROM footfall ORDER BY video_time ASC');
  const rows = [];
  const inMaleSeries = [];
  const inFemaleSeries = [];
  const inChildSeries = [];
  const outMaleSeries = [];
  const outFemaleSeries = [];
  const outChildSeries = [];

  while (stmt.step()) {
    const row = stmt.getAsObject();
    const inCount = parseInCount(row.in_count);
    const outCount = parseInCount(row.out_count);
    rows.push({
      video_time: row.video_time,
      in_count: inCount,
      out_count: outCount,
      avg_dwell_time: 0,
    });
    inMaleSeries.push(inCount[0]);
    inFemaleSeries.push(inCount[1]);
    inChildSeries.push(inCount[2]);
    outMaleSeries.push(outCount[0]);
    outFemaleSeries.push(outCount[1]);
    outChildSeries.push(outCount[2]);
  }
  stmt.free();

  computeFIFODwell(rows);

  return { rows, inMaleSeries, inFemaleSeries, inChildSeries, outMaleSeries, outFemaleSeries, outChildSeries };
}

function loadPasserby(db) {
  const stmt = db.prepare('SELECT video_time, in_count, out_count FROM passerby ORDER BY video_time ASC');
  const rows = [];
  const inMaleSeries = [];
  const inFemaleSeries = [];
  const inChildSeries = [];
  const outMaleSeries = [];
  const outFemaleSeries = [];
  const outChildSeries = [];

  while (stmt.step()) {
    const row = stmt.getAsObject();
    const inCount = parseInCount(row.in_count);
    const outCount = parseInCount(row.out_count);
    rows.push({
      video_time: row.video_time,
      in_count: inCount,
      out_count: outCount,
    });
    inMaleSeries.push(inCount[0]);
    inFemaleSeries.push(inCount[1]);
    inChildSeries.push(inCount[2]);
    outMaleSeries.push(outCount[0]);
    outFemaleSeries.push(outCount[1]);
    outChildSeries.push(outCount[2]);
  }
  stmt.free();

  return { rows, inMaleSeries, inFemaleSeries, inChildSeries, outMaleSeries, outFemaleSeries, outChildSeries };
}

function computeDwellFromIds(rows) {
  const entryTimes = {};
  const completedDwells = [];
  let prevIds = new Set();

  rows.forEach((row, t) => {
    const currentIds = new Set(
      [...row.man_id, ...row.woman_id, ...row.child_id].map(String)
    );

    currentIds.forEach((id) => {
      if (!(id in entryTimes)) entryTimes[id] = t;
    });

    prevIds.forEach((id) => {
      if (!currentIds.has(id)) {
        completedDwells.push(Math.max(1, t - entryTimes[id]));
        delete entryTimes[id];
      }
    });

    const sum = completedDwells.reduce((a, b) => a + b, 0);
    row.avg_dwell_time = completedDwells.length > 0 ? sum / completedDwells.length : 0;

    prevIds = new Set(currentIds);
  });
}

function loadZoneEntry(db) {
  const stmt = db.prepare(
    'SELECT video_time, man_count, woman_count, child_count, total_count, man_id, woman_id, child_id FROM women_clothing_zone ORDER BY video_time ASC'
  );
  const rows = [];
  const manSeries = [];
  const womanSeries = [];
  const childSeries = [];

  while (stmt.step()) {
    const row = stmt.getAsObject();
    const manCount  = Number(row.man_count)   || 0;
    const womanCount = Number(row.woman_count) || 0;
    const childCount = Number(row.child_count) || 0;
    const totalCount = Number(row.total_count) || (manCount + womanCount + childCount);
    rows.push({
      video_time:  row.video_time,
      man_count:   manCount,
      woman_count: womanCount,
      child_count: childCount,
      total_count: totalCount,
      man_id:   parseNumberArray(row.man_id),
      woman_id: parseNumberArray(row.woman_id),
      child_id: parseNumberArray(row.child_id),
      avg_dwell_time: 0,
    });
    manSeries.push(manCount);
    womanSeries.push(womanCount);
    childSeries.push(childCount);
  }
  stmt.free();

  computeDwellFromIds(rows);

  return { rows, manSeries, womanSeries, childSeries };
}

function parseHMSToSeconds(str) {
  if (typeof str === 'number') return str;
  const parts = String(str).split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(str) || 0;
}

function loadTrialRoom(db) {
  const stmt = db.prepare(
    'SELECT video_time, event_type, count_in, count_out, customer_count, unique_customer FROM trials ORDER BY video_time ASC'
  );
  const events = [];

  while (stmt.step()) {
    const row = stmt.getAsObject();
    const uniqueArr = parseArray(row.unique_customer);
    events.push({
      timeSeconds:    parseHMSToSeconds(row.video_time),
      event_type:     row.event_type,
      count_in:       Number(row.count_in)       || 0,
      count_out:      Number(row.count_out)      || 0,
      customer_count: Number(row.customer_count) || 0,
      unique_count:   uniqueArr.length,
      avg_dwell_time: 0,
    });
  }
  stmt.free();

  // FIFO dwell time across events
  const queue = [];
  const completedDwells = [];
  events.forEach((evt) => {
    if (evt.event_type === 'in') {
      queue.push(evt.timeSeconds);
    } else if (evt.event_type === 'out' && queue.length > 0) {
      const entryTime = queue.shift();
      completedDwells.push(Math.max(1, evt.timeSeconds - entryTime));
    }
    const sum = completedDwells.reduce((a, b) => a + b, 0);
    evt.avg_dwell_time = completedDwells.length > 0 ? sum / completedDwells.length : 0;
  });

  // Expand to per-second series for the graph
  const maxTime = events.length > 0 ? events[events.length - 1].timeSeconds : 0;
  const customerCountSeries = new Array(maxTime + 1).fill(0);
  let evtIdx = 0;
  let currentCount = 0;
  for (let t = 0; t <= maxTime; t++) {
    while (evtIdx < events.length && events[evtIdx].timeSeconds <= t) {
      currentCount = events[evtIdx].customer_count;
      evtIdx++;
    }
    customerCountSeries[t] = currentCount;
  }

  return { events, customerCountSeries };
}

function loadBHBilling(db) {
  const stmt = db.prepare(
    'SELECT video_time, employee_present, customer_count, employee_time_seconds, interaction_time_seconds FROM billing ORDER BY video_time ASC'
  );
  const rows = [];
  const customerSeries = [];

  while (stmt.step()) {
    const row = stmt.getAsObject();
    const customerCount = Number(row.customer_count) || 0;
    rows.push({
      video_time: row.video_time,
      employee_present: parseBoolean(row.employee_present),
      customer_count: customerCount,
      employee_time_seconds: Number(row.employee_time_seconds) || 0,
      interaction_time_seconds: Number(row.interaction_time_seconds) || 0,
    });
    customerSeries.push(customerCount);
  }
  stmt.free();

  return { rows, customerSeries };
}

// Loads a single KPI database from a URL and returns the relevant data for the given KPI type.
// kpiType: 'footfall' | 'passerby' | 'zone-entry' | 'billing'
export async function loadKpiDatabase(dbUrl, kpiType) {
  const db = await createDatabase(dbUrl);
  switch (kpiType) {
    case 'footfall':
      return { type: kpiType, data: loadFootfall(db) };
    case 'passerby':
      return { type: kpiType, data: loadPasserby(db) };
    case 'zone-entry':
      return { type: kpiType, data: loadZoneEntry(db) };
    case 'trial-room':
      return { type: kpiType, data: loadTrialRoom(db) };
    case 'billing':
      return { type: kpiType, data: loadBHBilling(db) };
    default:
      throw new Error(`Unknown KPI type: ${kpiType}`);
  }
}
