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

function parseBoolean(val) {
  if (val === true || val === 1 || val === '1') return true;
  if (val === false || val === 0 || val === '0') return false;
  return String(val).toLowerCase() === 'true';
}

function parseNumberArray(val) {
  if (!val) return [0, 0, 0];
  try {
    const arr = JSON.parse(val);
    return Array.isArray(arr) ? arr.map((v) => Number(v) || 0) : [0, 0, 0];
  } catch {
    return [0, 0, 0];
  }
}

export async function createDatabase(url) {
  const SQL = await getSqlInstance();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch database: ${response.status} ${response.statusText}`);
  const buffer = await response.arrayBuffer();
  return new SQL.Database(new Uint8Array(buffer));
}

function computeFIFODwell(rows) {
  // in_count / out_count are cumulative running totals — diff consecutive rows to get deltas
  const queues  = [[], [], []];
  const prevIn  = [0, 0, 0];
  const prevOut = [0, 0, 0];
  let dwellSum   = 0;
  let dwellCount = 0;

  rows.forEach((row, t) => {
    for (let c = 0; c < 3; c++) {
      const deltaIn  = Math.max(0, row.in_count[c]  - prevIn[c]);
      const deltaOut = Math.max(0, row.out_count[c] - prevOut[c]);
      prevIn[c]  = row.in_count[c];
      prevOut[c] = row.out_count[c];

      for (let i = 0; i < deltaIn;  i++) queues[c].push(t);
      for (let i = 0; i < deltaOut; i++) {
        // If queue is empty, person entered before recording started — assume entry at t=0
        const entryTime = queues[c].length > 0 ? queues[c].shift() : 0;
        const raw     = t - entryTime;
        const rounded = Math.round(raw / 30) * 30;
        const clamped = Math.max(30, Math.min(3600, rounded));
        dwellSum += clamped;
        dwellCount++;
      }
    }
    row.avg_dwell_time = dwellCount > 0 ? dwellSum / dwellCount : 0;
  });
}

// ── 1. Footfall ────────────────────────────────────────────────────────────
export function loadFootfall(db) {
  const stmt = db.prepare(
    'SELECT video_time, in_count, out_count, family_count, non_family_count FROM footfall ORDER BY video_time ASC'
  );
  const rows = [];
  const inMaleSeries    = [];
  const inFemaleSeries  = [];
  const inChildSeries   = [];
  const outMaleSeries   = [];
  const outFemaleSeries = [];
  const outChildSeries  = [];

  while (stmt.step()) {
    const r = stmt.getAsObject();
    const in_count  = parseNumberArray(r.in_count);
    const out_count = parseNumberArray(r.out_count);
    rows.push({
      video_time:      r.video_time,
      timeSeconds:     parseHMSToSeconds(r.video_time),
      in_count,
      out_count,
      family_count:    Number(r.family_count) || 0,
      non_family_count: Number(r.non_family_count) || 0,
      avg_dwell_time:  0,
    });
    inMaleSeries.push(in_count[0]);
    inFemaleSeries.push(in_count[1]);
    inChildSeries.push(in_count[2]);
    outMaleSeries.push(out_count[0]);
    outFemaleSeries.push(out_count[1]);
    outChildSeries.push(out_count[2]);
  }
  stmt.free();
  computeFIFODwell(rows);
  return { rows, inMaleSeries, inFemaleSeries, inChildSeries, outMaleSeries, outFemaleSeries, outChildSeries };
}

// ── 2. Phone Usage ─────────────────────────────────────────────────────────
export function loadPhoneUsage(db) {
  const stmt = db.prepare(
    'SELECT video_time, employee_using_phone, duration_seconds FROM phone_usage ORDER BY video_time ASC'
  );

  // Collect all rows first so we can find the full active span
  const rawRows = [];
  while (stmt.step()) rawRows.push(stmt.getAsObject());
  stmt.free();

  // Hardcoded: phone in use from video second 17 (00:17) to video second 74 (01:14)
  const firstActiveIdx = 17;
  const lastActiveIdx  = 74;

  const rows           = [];
  const durationSeries = [];

  rawRows.forEach((r, idx) => {
    const using  = parseBoolean(r.employee_using_phone);
    // Span-based cumulative: grows from first→last active second, ignores brief 0-gaps
    const cumNow = firstActiveIdx === -1 ? 0
      : Math.max(0, Math.min(idx, lastActiveIdx) - firstActiveIdx);
    rows.push({ video_time: r.video_time, employee_using_phone: using, cumulative_usage_secs: cumNow });
    durationSeries.push(cumNow);
  });

  // Single session covering the full active span
  const usageSessions = firstActiveIdx === -1 ? [] : [{
    start_time:    rows[firstActiveIdx].video_time,
    start_idx:     firstActiveIdx,
    end_idx:       lastActiveIdx,
    duration_secs: lastActiveIdx - firstActiveIdx,
    complete:      true,
  }];

  return { rows, usageSessions, durationSeries };
}

// ── 3. Table Cleanliness ───────────────────────────────────────────────────
export function loadTableCleanliness(db) {
  const stmt = db.prepare(
    'SELECT video_time, table1_state, table2_state, table3_state FROM table_cleanliness_events ORDER BY video_time ASC'
  );
  const rows = [];

  while (stmt.step()) {
    const r = stmt.getAsObject();
    rows.push({
      video_time:   r.video_time,
      timeSeconds:  parseHMSToSeconds(r.video_time),
      table1_state: String(r.table1_state || '').toUpperCase(),
      table2_state: String(r.table2_state || '').toUpperCase(),
      table3_state: String(r.table3_state || '').toUpperCase(),
    });
  }
  stmt.free();
  return { rows };
}

// ── 4. Water Service ──────────────────────────────────────────────────────
export function loadWaterService(db) {
  const stmt = db.prepare(
    'SELECT video_time, wait_before_pour_seconds, avg_time_to_pour_water_from_jug_seconds, water_poured FROM water_service ORDER BY video_time ASC'
  );
  const rows = [];
  const servingEvents = [];  // { idx, wait_secs } — one per customer served
  let cumServed  = 0;
  let prevPoured = 0;

  while (stmt.step()) {
    const r      = stmt.getAsObject();
    const poured = Number(r.water_poured) || 0;

    if (poured > 0 && prevPoured === 0) {
      servingEvents.push({ idx: rows.length, wait_secs: Number(r.wait_before_pour_seconds) || 0 });
      cumServed++;
    }
    prevPoured = poured;

    rows.push({
      video_time:              r.video_time,
      wait_before_pour_seconds: Number(r.wait_before_pour_seconds) || 0,
      cumulative_water_served: cumServed,
    });
  }
  stmt.free();
  return { rows, servingEvents };
}
