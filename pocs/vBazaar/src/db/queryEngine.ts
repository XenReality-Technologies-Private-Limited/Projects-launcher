import type { Database } from 'sql.js';
import type { GenderBreakdown, FootfallHourlyPoint, BillingSummaryData, BillingHourlyPoint, DwellData } from '../api';

// ── sql.js query helpers ──────────────────────────────────────────────────────

export function all(db: Database, sql: string, params: unknown[] = []): Record<string, unknown>[] {
  const stmt = db.prepare(sql);
  stmt.bind(params as never[]);
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as Record<string, unknown>);
  stmt.free();
  return rows;
}

export function one(db: Database, sql: string, params: unknown[] = []): Record<string, unknown> | null {
  const stmt = db.prepare(sql);
  stmt.bind(params as never[]);
  let row: Record<string, unknown> | null = null;
  if (stmt.step()) row = stmt.getAsObject() as Record<string, unknown>;
  stmt.free();
  return row;
}

// ── Utility ───────────────────────────────────────────────────────────────────

function pct(n: number, d: number): number { return d ? +((n / d) * 100).toFixed(1) : 0; }

function sumArr(v: unknown): number {
  try {
    const arr = JSON.parse(v as string);
    return Array.isArray(arr) ? arr.reduce((s: number, x: number) => s + (Number(x) || 0), 0) : 0;
  } catch { return 0; }
}

// ── Dwell time (derived from cumulative in_count / out_count) ─────────────────

export function calcDwell(db: Database): DwellData {
  // video_time format is "MMM:SS:??" where minutes can be 1-3 digits.
  // Use INSTR to find the colon so 3-digit minute values (100+) parse correctly.
  const rows = all(db, `
    SELECT
      CAST(SUBSTR(video_time, 1, INSTR(video_time,':') - 1) AS INTEGER) * 60
      + CAST(SUBSTR(video_time, INSTR(video_time,':')+1, 2) AS INTEGER) as t,
      COALESCE(CAST(json_extract(in_count,'$[0]')  AS INTEGER),0)
      + COALESCE(CAST(json_extract(in_count,'$[1]') AS INTEGER),0)
      + COALESCE(CAST(json_extract(in_count,'$[2]') AS INTEGER),0) as cum_in,
      COALESCE(CAST(json_extract(out_count,'$[0]') AS INTEGER),0)
      + COALESCE(CAST(json_extract(out_count,'$[1]') AS INTEGER),0)
      + COALESCE(CAST(json_extract(out_count,'$[2]') AS INTEGER),0) as cum_out
    FROM footfall ORDER BY t ASC
  `);
  if (!rows.length) return { average: 0, lessThan2: 0, twoTo10: 0, moreThan10: 0, total: 0 };

  const eq: number[] = [], xq: number[] = [], allDurs: number[] = [];
  let prevIn = 0, prevOut = 0;

  for (const row of rows) {
    const cumIn  = Number(row.cum_in)  || 0;
    const cumOut = Number(row.cum_out) || 0;
    const inc    = Math.max(0, cumIn  - prevIn);
    const outc   = Math.max(0, cumOut - prevOut);
    const t      = Number(row.t);
    prevIn = cumIn; prevOut = cumOut;

    for (let j = 0; j < inc;  j++) eq.push(t);
    for (let j = 0; j < outc; j++) xq.push(t);

    while (xq.length > 0 && eq.length > 0 && xq[0] <= eq[0]) xq.shift();
    while (eq.length && xq.length) {
      const norm = Math.max(30, Math.min(3600, Math.round((xq.shift()! - eq.shift()!) / 30) * 30));
      allDurs.push(norm);
    }
  }

  if (!allDurs.length) return { average: 0, lessThan2: 0, twoTo10: 0, moreThan10: 0, total: 0 };

  let lessThan2 = 0, twoTo10 = 0, moreThan10 = 0, totalSec = 0;
  for (const d of allDurs) {
    totalSec += d;
    if (d < 120) lessThan2++; else if (d <= 600) twoTo10++; else moreThan10++;
  }
  return {
    average:    Math.round((totalSec / allDurs.length) / 60 * 10) / 10,
    lessThan2, twoTo10, moreThan10, total: allDurs.length,
  };
}

// ── Footfall queries (schema: video_time TEXT 'HH:MM:SS', in_count TEXT, out_count TEXT) ──

export function queryFootfallSummary(db: Database): GenderBreakdown {
  // in_count stores a cumulative running total per frame — take the final (maximum) value
  const r = one(db, `
    SELECT
      MAX(CAST(json_extract(in_count,'$[0]') AS INT)) male,
      MAX(CAST(json_extract(in_count,'$[1]') AS INT)) female,
      MAX(CAST(json_extract(in_count,'$[2]') AS INT)) children
    FROM footfall
  `) || {};
  const male = Number(r.male) || 0, female = Number(r.female) || 0, children = Number(r.children) || 0;
  const total = male + female + children;
  return { total, male, female, children,
    malePercent: pct(male, total), femalePercent: pct(female, total), childPercent: pct(children, total) };
}

export function queryFootfallHourly(db: Database): FootfallHourlyPoint[] {
  // Bucket per-minute rows into 60-minute intervals to get hourly totals.
  // in_count is cumulative — take the max within each bucket, then delta vs previous.
  const rows = all(db, `
    SELECT
      CAST(CAST(SUBSTR(video_time, 1, INSTR(video_time,':') - 1) AS INTEGER) / 60 AS INTEGER) as hour,
      MAX(CAST(json_extract(in_count,'$[0]') AS INT)) as male,
      MAX(CAST(json_extract(in_count,'$[1]') AS INT)) as female,
      MAX(CAST(json_extract(in_count,'$[2]') AS INT)) as children
    FROM footfall
    GROUP BY hour ORDER BY hour
  `);
  return rows.map((r, i) => {
    const maleCumul     = Number(r.male)     || 0;
    const femaleCumul   = Number(r.female)   || 0;
    const childCumul    = Number(r.children) || 0;
    const prevMale      = i > 0 ? (Number(rows[i - 1].male)     || 0) : 0;
    const prevFemale    = i > 0 ? (Number(rows[i - 1].female)   || 0) : 0;
    const prevChildren  = i > 0 ? (Number(rows[i - 1].children) || 0) : 0;
    const male     = Math.max(0, maleCumul   - prevMale);
    const female   = Math.max(0, femaleCumul - prevFemale);
    const children = Math.max(0, childCumul  - prevChildren);
    return {
      hour:       `Hour ${Number(r.hour) + 1}`,
      male,
      female,
      children,
      total:      male + female + children,
      cumulative: maleCumul + femaleCumul + childCumul,
    };
  });
}

// ── Billing queries (schema: video_time TEXT 'HH:MM:SS', employee_present TEXT/INTEGER,
//    customer_count INTEGER, employee_time_seconds REAL, interaction_time_seconds REAL) ──

export function queryBillingSummary(db: Database): BillingSummaryData {
  const r = one(db, `
    SELECT
      AVG(customer_count)                                                                       as avg_customers,
      MAX(customer_count)                                                                       as peak_customers,
      SUM(CASE WHEN employee_present = 1 OR employee_present = 'true' THEN 1 ELSE 0 END)
        * 100.0 / COUNT(*)                                                                      as employee_uptime_pct,
      -- Derive actual seconds from row proportion × total video duration
      SUM(CASE WHEN employee_present = 1 OR employee_present = 'true' THEN 1 ELSE 0 END)
        * 1.0 / COUNT(*) *
        (CAST(substr(MAX(video_time),1,2) AS INTEGER)*60
         + CAST(substr(MAX(video_time),4,2) AS INTEGER))                                       as total_employee_time,
      -- Interaction = employee present AND at least 1 customer simultaneously
      SUM(CASE WHEN (employee_present = 1 OR employee_present = 'true') AND customer_count > 0
               THEN 1 ELSE 0 END)
        * 1.0 / COUNT(*) *
        (CAST(substr(MAX(video_time),1,2) AS INTEGER)*60
         + CAST(substr(MAX(video_time),4,2) AS INTEGER))                                       as total_interaction_time,
      SUM(CASE WHEN customer_count < 2 THEN 1 ELSE 0 END)                                      as queue_low,
      SUM(CASE WHEN customer_count BETWEEN 2 AND 3 THEN 1 ELSE 0 END)                         as queue_medium,
      SUM(CASE WHEN customer_count > 3 THEN 1 ELSE 0 END)                                      as queue_high,
      COUNT(*)                                                                                  as total_rows
    FROM billing
  `) || {};
  return {
    avgCustomers:          Math.round(Number(r.avg_customers) || 0),
    peakCustomers:          Number(r.peak_customers)        || 0,
    employeeUptimePct:     +(Number(r.employee_uptime_pct)  || 0).toFixed(1),
    totalEmployeeTime:      Number(r.total_employee_time)   || 0,
    totalInteractionTime:   Number(r.total_interaction_time)|| 0,
    queueLow:               Number(r.queue_low)             || 0,
    queueMedium:            Number(r.queue_medium)          || 0,
    queueHigh:              Number(r.queue_high)            || 0,
    totalRows:              Number(r.total_rows)            || 0,
  };
}

export function queryBillingHourly(db: Database): BillingHourlyPoint[] {
  const rows = all(db, `
    SELECT
      CAST(CAST(substr(video_time, 1, 2) AS INTEGER) / 60 AS INTEGER) as hour,
      AVG(customer_count) as avg_count,
      MAX(customer_count) as max_count,
      SUM(CASE WHEN employee_present = 1 OR employee_present = 'true' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as uptime_pct
    FROM billing
    GROUP BY hour ORDER BY hour
  `);
  return rows.map(r => ({
    hour:      `Hour ${Number(r.hour) + 1}`,
    avgCount:  Math.round(Number(r.avg_count)  || 0),
    maxCount:   Number(r.max_count)             || 0,
    uptimePct: +(Number(r.uptime_pct)          || 0).toFixed(1),
  }));
}
