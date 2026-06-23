import initSqlJs from 'sql.js';

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

async function createDatabase() {
  const SQL = await initSqlJs({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/sql.js@1.14.0/dist/${file}`,
  });

  const response = await fetch('/reliance.db');
  if (!response.ok) {
    throw new Error(`Failed to fetch reliance.db: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return new SQL.Database(bytes);
}

function loadFootfall(db) {
  const stmt = db.prepare('SELECT video_time, in_count FROM footfall ORDER BY video_time ASC');
  const rows = [];
  const maleSeries = [];
  const femaleSeries = [];
  const childSeries = [];

  while (stmt.step()) {
    const row = stmt.getAsObject();
    const inCount = parseInCount(row.in_count);
    rows.push({
      video_time: row.video_time,
      in_count: inCount,
    });
    maleSeries.push(inCount[0]);
    femaleSeries.push(inCount[1]);
    childSeries.push(inCount[2]);
  }
  stmt.free();

  return { rows, maleSeries, femaleSeries, childSeries };
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

function loadFirstZone(db) {
  const stmt = db.prepare(
    'SELECT video_time, apple_count, android_count FROM first_zoneentry ORDER BY video_time ASC'
  );
  const rows = [], appleSeries = [], androidSeries = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    const apple = Number(row.apple_count) || 0;
    const android = Number(row.android_count) || 0;
    rows.push({ video_time: row.video_time, apple_count: apple, android_count: android });
    appleSeries.push(apple);
    androidSeries.push(android);
  }
  stmt.free();
  return { rows, appleSeries, androidSeries };
}

function loadGreetings(db) {
  const stmt = db.prepare(
    'SELECT video_time, attended, customer_ids, wait_time FROM greetings ORDER BY video_time ASC'
  );
  const rows = [], attendedSeries = [], unattendedSeries = [], avgWaitSeries = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    const attended = Number(row.attended) || 0;
    const customerIds = parseArray(row.customer_ids);
    const waitTime = Number(row.wait_time) || 0;
    const avgWaitTime = customerIds.length > 0 ? Math.round(waitTime / customerIds.length) : 0;
    rows.push({ video_time: row.video_time, attended, avg_wait_time: avgWaitTime });
    attendedSeries.push(attended);
    unattendedSeries.push(0);
    avgWaitSeries.push(avgWaitTime);
  }
  stmt.free();
  return { rows, attendedSeries, unattendedSeries, avgWaitSeries };
}

export async function initDatabase() {
  const db = await createDatabase();

  return {
    footfall: loadFootfall(db),
    trials: loadTrials(db),
    firstZone: loadFirstZone(db),
    greetings: loadGreetings(db),
  };
}
