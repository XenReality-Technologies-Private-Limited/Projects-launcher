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

function loadTrials(db) {
  const hasCustomerColumn = (() => {
    try {
      const info = db.exec("PRAGMA table_info(trials)");
      if (!info.length || !info[0].values) return false;
      return info[0].values.some((row) => row[1] === 'customer');
    } catch {
      return false;
    }
  })();

  const selectColumns = hasCustomerColumn
    ? 'video_time, employee, customer, customer_id, unique_customer'
    : 'video_time, employee, customer_id, unique_customer';

  const stmt = db.prepare(
    `SELECT ${selectColumns} FROM trials ORDER BY video_time ASC`
  );
  const rows = [];
  const customerSeries = [];

  while (stmt.step()) {
    const row = stmt.getAsObject();
    const customerId = parseArray(row.customer_id);
    const uniqueCustomer = parseArray(row.unique_customer);
    const customer = hasCustomerColumn
      ? (typeof row.customer === 'number' ? row.customer : Number(row.customer) || 0)
      : customerId.length;
    rows.push({
      video_time: row.video_time,
      employee: parseBoolean(row.employee),
      customer,
      customer_id: customerId,
      unique_customer: uniqueCustomer,
      uniqueCount: uniqueCustomer.length,
    });
    customerSeries.push(customer);
  }
  stmt.free();

  let runningSum = 0;
  rows.forEach((r) => {
    runningSum += r.uniqueCount;
    r.cumulativeUnique = runningSum;
  });

  return { rows, customerSeries };
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
    case 'passerby':
      return { type: kpiType, data: loadFootfall(db) };
    case 'zone-entry':
      return { type: kpiType, data: loadTrials(db) };
    case 'billing':
      return { type: kpiType, data: loadBHBilling(db) };
    default:
      throw new Error(`Unknown KPI type: ${kpiType}`);
  }
}
