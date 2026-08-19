import initSqlJs from 'sql.js';

// [male, female, child] from in_count/out_count; ensures length 3.
function parseCountArray(str) {
  if (str == null || str === '') return [0, 0, 0];
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) return [parsed[0]||0, parsed[1]||0, parsed[2]||0];
  } catch {
    const parts = String(str).split(',').map((s) => Number(s.trim()));
    return [parts[0]||0, parts[1]||0, parts[2]||0];
  }
  return [0, 0, 0];
}

async function createDatabase(url) {
  const SQL = await initSqlJs({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/sql.js@1.14.0/dist/${file}`,
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return new SQL.Database(bytes);
}

function loadFootfall(db) {
  const stmt = db.prepare('SELECT time_stamp as video_time, in_count, out_count FROM footfall ORDER BY time_stamp ASC');
  const rows = [];
  const inSeries = { male: [], female: [], child: [] };
  const outSeries = { male: [], female: [], child: [] };

  while (stmt.step()) {
    const row = stmt.getAsObject();
    const inCount = parseCountArray(row.in_count);
    const outCount = parseCountArray(row.out_count);
    const totalIn = inCount[0] + inCount[1] + inCount[2];
    const totalOut = outCount[0] + outCount[1] + outCount[2];

    rows.push({
      video_time: row.video_time,
      in_count: inCount,
      out_count: outCount,
      total_in: totalIn,
      total_out: totalOut,
    });
    inSeries.male.push(inCount[0]);
    inSeries.female.push(inCount[1]);
    inSeries.child.push(inCount[2]);

    outSeries.male.push(outCount[0]);
    outSeries.female.push(outCount[1]);
    outSeries.child.push(outCount[2]);
  }
  stmt.free();

  return { rows, inSeries, outSeries };
}

function loadZone(db) {
  const stmt = db.prepare('SELECT timestamp as video_time, customer_presence, employee_presence FROM presence ORDER BY timestamp ASC');
  const rows = [];
  const interactionSeries = [];

  let runningSum = 0;
  let prevTime = 0;
  while (stmt.step()) {
    const row = stmt.getAsObject();
    const customer = Number(row.customer_presence) || 0;
    const employee = Number(row.employee_presence) || 0;
    
    let dt = row.video_time - prevTime;
    if (dt < 0 || dt > 2) dt = 0;
    prevTime = row.video_time;

    if (employee > 0 && customer > 0) {
      runningSum += dt;
    }

    rows.push({
      video_time: row.video_time,
      customer,
      employee,
      cumulativeInteraction: Math.floor(runningSum)
    });
    interactionSeries.push(Math.floor(runningSum));
  }
  stmt.free();

  return { rows, interactionSeries };
}

export async function initDatabase() {
  const footfallDb = await createDatabase('https://d2uimaqek2eby3.cloudfront.net/Majestic-Maharaja/footfall.db');
  const zoneDb = await createDatabase('https://d2uimaqek2eby3.cloudfront.net/Majestic-Maharaja/ladies_dwell_presence.db');

  return {
    footfall: loadFootfall(footfallDb),
    zone: loadZone(zoneDb),
  };
}
