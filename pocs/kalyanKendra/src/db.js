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

function parseArr(raw) {
  try { return JSON.parse(raw); } catch { return [0, 0, 0]; }
}

export async function loadAllData(url) {
  const SQL = await getSqlInstance();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching database`);
  const buffer = await response.arrayBuffer();
  const db = new SQL.Database(new Uint8Array(buffer));

  // ── 1. Footfall ───────────────────────────────────────────────────────────
  // in_count / out_count are running totals "[male,female,child]".
  // avg_dwell_time computed via FIFO queue (same as New_POC_Website computeFIFODwell):
  //   derive per-row deltas from running totals, queue entry times, dequeue on exit.
  //   Dwell rounded to nearest 30s, clamped [30, 3600].
  const footfallRows = [];
  const maleInSeries = [], femaleInSeries = [], childInSeries = [];

  const ffStmt = db.prepare(
    'SELECT video_time, in_count, out_count FROM footfall ORDER BY video_time ASC'
  );
  while (ffStmt.step()) {
    const r = ffStmt.getAsObject();
    const inArr  = parseArr(r.in_count);
    const outArr = parseArr(r.out_count);
    footfallRows.push({
      video_time: r.video_time,
      timeSeconds: parseHMSToSeconds(r.video_time),
      cumMaleIn:    Number(inArr[0])  || 0,
      cumFemaleIn:  Number(inArr[1])  || 0,
      cumChildIn:   Number(inArr[2])  || 0,
      cumMaleOut:   Number(outArr[0]) || 0,
      cumFemaleOut: Number(outArr[1]) || 0,
      cumChildOut:  Number(outArr[2]) || 0,
      avg_dwell_time: 0,
    });
  }
  ffStmt.free();

  // Post-process: compute per-row deltas then FIFO dwell
  {
    const queues = [[], [], []]; // male, female, child
    let dwellSum = 0, dwellCount = 0;
    footfallRows.forEach((row, i) => {
      row.totalIn  = row.cumMaleIn  + row.cumFemaleIn  + row.cumChildIn;
      row.totalOut = row.cumMaleOut + row.cumFemaleOut + row.cumChildOut;
      const prev = footfallRows[i - 1];
      const prevIn  = prev ? [prev.cumMaleIn,  prev.cumFemaleIn,  prev.cumChildIn]  : [0, 0, 0];
      const prevOut = prev ? [prev.cumMaleOut, prev.cumFemaleOut, prev.cumChildOut] : [0, 0, 0];
      const cumIn  = [row.cumMaleIn,  row.cumFemaleIn,  row.cumChildIn];
      const cumOut = [row.cumMaleOut, row.cumFemaleOut, row.cumChildOut];

      for (let c = 0; c < 3; c++) {
        const deltaIn  = Math.max(0, cumIn[c]  - prevIn[c]);
        const deltaOut = Math.max(0, cumOut[c] - prevOut[c]);
        for (let j = 0; j < deltaIn;  j++) queues[c].push(i);
        for (let j = 0; j < deltaOut; j++) {
          if (queues[c].length > 0) {
            const raw = i - queues[c].shift();
            dwellSum += raw;
            dwellCount++;
          }
        }
      }
      row.avg_dwell_time = dwellCount > 0 ? dwellSum / dwellCount : 0;
      maleInSeries.push(row.cumMaleIn);
      femaleInSeries.push(row.cumFemaleIn);
      childInSeries.push(row.cumChildIn);
    });
  }

  // ── 2. Greetings ──────────────────────────────────────────────────────────
  // wait_time is ignored per requirements
  const greetingsRows = [];
  const greetedSeries = [], unattendedSeries = [];

  const grStmt = db.prepare(
    'SELECT video_time, greeted, unattended FROM greetings ORDER BY video_time ASC'
  );
  while (grStmt.step()) {
    const r = grStmt.getAsObject();
    const greeted    = Number(r.greeted)    || 0;
    const unattended = Number(r.unattended) || 0;
    greetingsRows.push({
      video_time: r.video_time,
      timeSeconds: parseHMSToSeconds(r.video_time),
      greeted,
      unattended,
    });
    greetedSeries.push(greeted);
    unattendedSeries.push(unattended);
  }
  grStmt.free();

  // ── 3. Pantry ─────────────────────────────────────────────────────────────
  // total_pantry_time is cumulative minutes (grows by ~1 per 1-min row)
  const pantryRows = [];
  const employeeInZoneSeries = [];

  const paStmt = db.prepare(
    'SELECT video_time, employee_in_zone, total_pantry_time FROM pantry ORDER BY video_time ASC'
  );
  while (paStmt.step()) {
    const r = paStmt.getAsObject();
    const employeeInZone  = Number(r.employee_in_zone)  || 0;
    const totalPantryTime = Number(r.total_pantry_time) || 0;
    pantryRows.push({
      video_time: r.video_time,
      timeSeconds: parseHMSToSeconds(r.video_time),
      employee_in_zone: employeeInZone,
      total_pantry_time: totalPantryTime,
    });
    employeeInZoneSeries.push(employeeInZone);
  }
  paStmt.free();

  // ── 4. Trials ─────────────────────────────────────────────────────────────
  // Derive cumulative employee-only time: employee_in > 0 AND customer_in == 0
  // Each row ≈ 1 minute of video time, so each qualifying row adds 60 seconds.
  const trialsRows = [];
  const customerInSeries = [];
  let cumEmployeeOnlySecs = 0;

  const trStmt = db.prepare(
    'SELECT video_time, employee_in, employee_out, customer_in, customer_out, avg_dwell_time FROM trials ORDER BY video_time ASC'
  );
  while (trStmt.step()) {
    const r = trStmt.getAsObject();
    const employeeIn = Number(r.employee_in)  || 0;
    const customerIn = Number(r.customer_in)  || 0;
    if (employeeIn > 0 && customerIn === 0) cumEmployeeOnlySecs += 60;
    trialsRows.push({
      video_time: r.video_time,
      timeSeconds: parseHMSToSeconds(r.video_time),
      employee_in:  employeeIn,
      employee_out: Number(r.employee_out)  || 0,
      customer_in:  customerIn,
      customer_out: Number(r.customer_out)  || 0,
      avg_dwell_time: Number(r.avg_dwell_time) || 0,
      cumEmployeeOnlySecs,
    });
    customerInSeries.push(customerIn);
  }
  trStmt.free();

  db.close();

  return {
    footfall:  { rows: footfallRows,  maleInSeries, femaleInSeries, childInSeries },
    greetings: { rows: greetingsRows, greetedSeries, unattendedSeries },
    pantry:    { rows: pantryRows,    employeeInZoneSeries },
    trials:    { rows: trialsRows,    customerInSeries },
  };
}
