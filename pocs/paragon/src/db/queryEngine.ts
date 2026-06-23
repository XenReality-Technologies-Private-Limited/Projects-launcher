import type { Database } from 'sql.js';
import type {
  GenderBreakdown, DwellData,
  SummaryData, TrendPoint, HourlyPoint,
  AnalysisDetailData,
  PeriodsData,
  MultiPoint, SinglePoint,
  ClearanceState, ClearanceAlert,
  FootfallStats,
} from '../api';

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

// ── Schema ────────────────────────────────────────────────────────────────────

export const CREATE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS footfall  (unixtime INTEGER, duration INTEGER, in_count TEXT, out_count TEXT, group_in INTEGER, solo_in INTEGER);
  CREATE TABLE IF NOT EXISTS passers_by(unixtime INTEGER, duration INTEGER, in_count TEXT, out_count TEXT);
  CREATE TABLE IF NOT EXISTS greeting  (unixtime INTEGER, duration INTEGER, greeted INTEGER, unattended INTEGER);
  CREATE TABLE IF NOT EXISTS trials    (unixtime INTEGER, cid INTEGER, cin_zone INTEGER);
  CREATE TABLE IF NOT EXISTS billing   (unixtime INTEGER, cid INTEGER, cin_zone INTEGER);
  CREATE TABLE IF NOT EXISTS clearance (unixtime INTEGER, is_occupied INTEGER, is_clean INTEGER, unclean_duration INTEGER);
`;

export const CREATE_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_footfall_t  ON footfall(unixtime);
  CREATE INDEX IF NOT EXISTS idx_passersby_t ON passers_by(unixtime);
  CREATE INDEX IF NOT EXISTS idx_greeting_t  ON greeting(unixtime);
  CREATE INDEX IF NOT EXISTS idx_trials_t    ON trials(unixtime);
  CREATE INDEX IF NOT EXISTS idx_billing_t   ON billing(unixtime);
  CREATE INDEX IF NOT EXISTS idx_clearance_t ON clearance(unixtime);
`;

// ── Utility helpers ───────────────────────────────────────────────────────────

function parseArr(s: unknown): number[] {
  try { return JSON.parse(s as string) || [0, 0, 0]; } catch { return [0, 0, 0]; }
}
function sumArr(a: unknown): number {
  if (!Array.isArray(a)) return 0;
  return (a as unknown[]).reduce<number>((s, v) => s + (Number(v) || 0), 0);
}
function pct(n: number, d: number): number { return d ? +((n / d) * 100).toFixed(1) : 0; }

// Fixed IST offset (+5:30 = 19800 seconds) — browser sql.js WASM uses UTC, not localtime.
const IST_OFFSET = 19800;
const HOUR_FILTER = `CAST(strftime('%H', datetime(unixtime + ${IST_OFFSET}, 'unixepoch')) AS INTEGER) BETWEEN 10 AND 22`;
const H = `CAST(strftime('%H', datetime(unixtime + ${IST_OFFSET}, 'unixepoch')) AS INT)`;

function buildWhere(start?: number, end?: number): { clause: string; params: number[] } {
  const c = [HOUR_FILTER], p: number[] = [];
  if (start != null) { c.push('unixtime >= ?'); p.push(start); }
  if (end   != null) { c.push('unixtime < ?');  p.push(end); }
  return { clause: `WHERE ${c.join(' AND ')}`, params: p };
}

// ── KPI queries ───────────────────────────────────────────────────────────────

export function getFootfall(db: Database, start?: number, end?: number): GenderBreakdown {
  const { clause, params } = buildWhere(start, end);
  const r = one(db, `
    SELECT
      SUM(CAST(json_extract(in_count,'$[0]') AS INT)) male,
      SUM(CAST(json_extract(in_count,'$[1]') AS INT)) female,
      SUM(CAST(json_extract(in_count,'$[2]') AS INT)) children
    FROM footfall ${clause}
  `, params) || {};
  const male = Number(r.male) || 0, female = Number(r.female) || 0, children = Number(r.children) || 0;
  const total = male + female + children;
  return { total, male, female, children, malePercent: pct(male, total), femalePercent: pct(female, total), childPercent: pct(children, total) };
}

export function getFootfallStats(db: Database, start?: number, end?: number): FootfallStats {
  const { clause, params } = buildWhere(start, end);
  const r = one(db, `
    SELECT
      SUM(CAST(json_extract(in_count,'$[0]') AS INT) +
          CAST(json_extract(in_count,'$[1]') AS INT) +
          CAST(json_extract(in_count,'$[2]') AS INT)) total,
      SUM(COALESCE(group_in, 0)) groupIn,
      SUM(COALESCE(solo_in,  0)) soloIn
    FROM footfall ${clause}
  `, params) || {};
  return {
    total:   Number(r.total)   || 0,
    groupIn: Number(r.groupIn) || 0,
    soloIn:  Number(r.soloIn)  || 0,
  };
}

export function calcDwell(db: Database, start: number, end: number): DwellData {
  const rawRows = all(db,
    `SELECT unixtime, in_count, out_count FROM footfall
     WHERE unixtime >= ? AND unixtime < ? ORDER BY unixtime ASC`,
    [start, end]
  );

  const rows = rawRows.filter(r => {
    const h = Math.floor(((Number(r.unixtime) + IST_OFFSET) % 86400) / 3600);
    return h >= 10 && h <= 22;
  });

  if (!rows.length) return { average: 0, lessThan2: 0, twoTo10: 0, moreThan10: 0 };

  const eq: number[] = [], xq: number[] = [], allDurs: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const inc  = sumArr(parseArr(rows[i].in_count));
    const outc = sumArr(parseArr(rows[i].out_count));
    const t    = Number(rows[i].unixtime);

    if (i === 0 && inc === 0 && outc > 0) continue;

    for (let j = 0; j < inc;  j++) eq.push(t);
    for (let j = 0; j < outc; j++) xq.push(t);

    while (xq.length > 0 && eq.length > 0 && xq[0] <= eq[0]) xq.shift();

    while (eq.length && xq.length) {
      const raw  = xq.shift()! - eq.shift()!;
      const norm = Math.max(30, Math.min(3600, Math.round(raw / 30) * 30));
      allDurs.push(norm);
    }
  }

  if (!allDurs.length) return { average: 0, lessThan2: 0, twoTo10: 0, moreThan10: 0 };

  let lessThan2 = 0, twoTo10 = 0, moreThan10 = 0, totalSec = 0;
  for (const d of allDurs) {
    totalSec += d;
    if (d < 120) lessThan2++; else if (d <= 600) twoTo10++; else moreThan10++;
  }
  const average = Math.round((totalSec / allDurs.length) / 60 * 10) / 10;
  return { average, lessThan2, twoTo10, moreThan10 };
}

// ── Clearance queries ─────────────────────────────────────────────────────────

function _stateForTable(db: Database, tbl: string): ClearanceState | null {
  const r = one(db, `SELECT is_occupied, is_clean, unclean_duration FROM ${tbl} ORDER BY unixtime DESC LIMIT 1`);
  if (!r) return null;
  let uncleanSince: number | undefined;
  if (Number(r.is_clean) !== 1) {
    const us = one(db, `
      SELECT MIN(unixtime) as ts FROM ${tbl}
      WHERE is_clean = 0
      AND unixtime > COALESCE((SELECT MAX(unixtime) FROM ${tbl} WHERE is_clean = 1), 0)
    `);
    if (us?.ts) uncleanSince = Number(us.ts);
  }
  return {
    isOccupied: Number(r.is_occupied) === 1,
    isClean: Number(r.is_clean) === 1,
    uncleanDuration: Number(r.unclean_duration) || 0,
    uncleanSince,
  };
}

export function getClearanceState(db: Database): ClearanceState | null {
  return _stateForTable(db, 'clearance');
}

export function getClearanceStates(db: Database): Array<ClearanceState & { tableLabel: string }> {
  const tables: [string, string][] = [
    ['clearance', 'Table 1'],
  ];
  return tables.map(([tbl, tableLabel]) => {
    const exists = one(db, `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tbl]);
    const s = exists ? _stateForTable(db, tbl) : null;
    return {
      tableLabel,
      isOccupied:      s?.isOccupied      ?? false,
      isClean:         s?.isClean         ?? true,
      uncleanDuration: s?.uncleanDuration ?? 0,
      uncleanSince:    s?.uncleanSince,
    };
  });
}

function _alertsForTable(
  db: Database, tbl: string, tableLabel: string,
  whereClause: string, params: number[],
): ClearanceAlert[] {
  const rows = all(db, `SELECT unixtime, is_occupied, is_clean, unclean_duration FROM ${tbl} ${whereClause} ORDER BY unixtime ASC`, params);
  const alerts: ClearanceAlert[] = [];
  let streakStart: number | null = null;
  let currentStreak: ClearanceAlert | null = null;

  for (const row of rows) {
    const ts  = Number(row.unixtime);
    const dur = Number(row.unclean_duration) || 0;
    if (Number(row.is_clean) === 1) {
      if (currentStreak) {
        alerts.push({ tableId: tbl, tableLabel, unixtime: currentStreak.unixtime, uncleanDuration: Math.max(currentStreak.uncleanDuration, dur) });
      } else if (dur > 60) {
        alerts.push({ tableId: tbl, tableLabel, unixtime: streakStart ?? ts, uncleanDuration: dur });
      }
      currentStreak = null;
      streakStart   = null;
    } else {
      if (streakStart === null) streakStart = ts;
      if (Number(row.is_occupied) !== 1 && dur > 60) {
        currentStreak = { tableId: tbl, tableLabel, unixtime: streakStart, uncleanDuration: dur };
      }
    }
  }
  if (currentStreak) alerts.push(currentStreak);
  return alerts;
}

export function getClearanceAlerts(db: Database, start?: number, end?: number, limit = 50): ClearanceAlert[] {
  const parts: string[] = [];
  const params: number[] = [];
  if (start != null) { parts.push('unixtime >= ?'); params.push(start); }
  if (end   != null) { parts.push('unixtime < ?');  params.push(end); }
  const whereClause = parts.length ? `WHERE ${parts.join(' AND ')}` : '';

  const tables: [string, string][] = [
    ['clearance', 'Table 1'],
  ];

  const all_alerts: ClearanceAlert[] = [];
  for (const [tbl, tableLabel] of tables) {
    const exists = one(db, `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tbl]);
    if (!exists) continue;
    all_alerts.push(..._alertsForTable(db, tbl, tableLabel, whereClause, params));
  }

  return all_alerts.sort((a, b) => b.unixtime - a.unixtime).slice(0, limit);
}

// ── Time bucket generators ────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function dateBuckets(startTs: number, endTs: number) {
  const buckets: { label: string; start: number; end: number }[] = [];
  let cur = new Date(startTs * 1000);
  cur.setHours(0, 0, 0, 0);
  const limit = new Date(endTs * 1000);
  while (cur <= limit) {
    const start = Math.floor(cur.getTime() / 1000);
    const next  = new Date(cur); next.setDate(next.getDate() + 1);
    buckets.push({ label: `${MONTHS[cur.getMonth()]} ${cur.getDate()}`, start, end: Math.floor(next.getTime() / 1000) });
    cur = next;
  }
  return buckets;
}

function getLatestDataDate(db: Database): string | null {
  try {
    const r = one(db, `
      SELECT date(unixtime + ${IST_OFFSET}, 'unixepoch') AS d
      FROM "footfall" WHERE unixtime > 0
      ORDER BY unixtime DESC LIMIT 1
    `);
    if (r && r.d) return r.d as string;
  } catch {}
  return null;
}

function getLatestTs(db: Database): number {
  const dateStr = getLatestDataDate(db);
  if (dateStr) {
    const [y, m, d] = (dateStr as string).split('-').map(Number);
    return Math.floor(new Date(y, m - 1, d, 23, 59, 59).getTime() / 1000);
  }
  return Math.floor(Date.now() / 1000);
}

function lastNDays(n: number, refTs?: number) {
  const buckets: { label: string; start: number; end: number }[] = [];
  const now = refTs ? new Date(refTs * 1000) : new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
    const start = Math.floor(d.getTime() / 1000);
    const next  = new Date(d); next.setDate(next.getDate() + 1);
    buckets.push({ label: DAYS[d.getDay()], start, end: Math.floor(next.getTime() / 1000) });
  }
  return buckets;
}

function singleTs(buckets: { label: string; start: number; end: number }[], fn: (s: number, e: number) => number): SinglePoint[] {
  return buckets.map(b => ({ label: b.label, value: fn(b.start, b.end) }));
}

function footfallTs(db: Database, buckets: { label: string; start: number; end: number }[]): MultiPoint[] {
  return buckets.map(({ label, start, end }) => {
    const r = one(db, `
      SELECT
        SUM(CAST(json_extract(in_count,'$[0]') AS INT)) male,
        SUM(CAST(json_extract(in_count,'$[1]') AS INT)) female,
        SUM(CAST(json_extract(in_count,'$[2]') AS INT)) children
      FROM footfall WHERE unixtime >= ? AND unixtime < ?
    `, [start, end]) || {};
    return { label, male: Number(r.male) || 0, female: Number(r.female) || 0, children: Number(r.children) || 0 };
  });
}

// ── Public query functions ────────────────────────────────────────────────────

export function querySummary(db: Database, start?: number, end?: number): SummaryData {
  const nowSec = Math.floor(Date.now() / 1000);
  const dStart = start ?? (nowSec - 86400);
  const dEnd   = end   ?? nowSec;
  return {
    footfall:  getFootfall(db, start, end),
    dwellTime: calcDwell(db, dStart, dEnd),
  };
}

export function queryTrend(db: Database, start: number, end: number): TrendPoint[] {
  return dateBuckets(start, end).map(({ label, start: s, end: e }) => {
    const ff = getFootfall(db, s, e);
    return { date: label, footfall: ff.total };
  });
}

export function queryHourly(db: Database, start?: number, end?: number): HourlyPoint[] {
  function hourWhere(extraClauses: string[] = []): { where: string; params: number[] } {
    const parts = [`${H} BETWEEN 10 AND 21`, ...extraClauses];
    const p: number[] = [];
    if (start != null) { parts.push('unixtime >= ?'); p.push(start); }
    if (end   != null) { parts.push('unixtime < ?');  p.push(end); }
    return { where: `WHERE ${parts.join(' AND ')}`, params: p };
  }

  const { where: ffW, params: ffP } = hourWhere();
  const ffRows = all(db, `
    SELECT ${H} as h,
      SUM(COALESCE(CAST(json_extract(in_count,'$[0]') AS INT),0)+
          COALESCE(CAST(json_extract(in_count,'$[1]') AS INT),0)+
          COALESCE(CAST(json_extract(in_count,'$[2]') AS INT),0)) as total
    FROM footfall ${ffW} GROUP BY h ORDER BY h
  `, ffP);

  const ffMap = new Map(ffRows.map(r => [Number(r.h), Number(r.total) || 0]));

  const nowSec = Math.floor(Date.now() / 1000);
  const dStart = start ?? (nowSec - 86400);
  const dEnd   = end   ?? nowSec;
  const overallDwellAvg = calcDwell(db, dStart, dEnd).average;

  return Array.from({ length: 12 }, (_, i) => {
    const h    = 10 + i;
    const hour = `${h.toString().padStart(2, '0')}:00`;
    return {
      hour,
      footfall: ffMap.get(h) || 0,
      dwell:    overallDwellAvg,
    };
  });
}

export function queryAnalysisDetail(db: Database, start: number, end: number): AnalysisDetailData {
  const buckets = dateBuckets(start, end);
  const daily = buckets.map(({ label, start: s, end: e }) => {
    const ff = getFootfall(db, s, e);
    return {
      date: label,
      footfall: { male: ff.male, female: ff.female, children: ff.children },
      dwell:    calcDwell(db, s, e).average,
    };
  });

  const numDays = Math.max(buckets.length, 1);
  const p = [start, end];
  const baseClause = `${H} BETWEEN 10 AND 21 AND unixtime >= ? AND unixtime < ?`;

  const ffHRows = all(db, `
    SELECT ${H} as h,
      SUM(COALESCE(CAST(json_extract(in_count,'$[0]') AS INT),0)) male,
      SUM(COALESCE(CAST(json_extract(in_count,'$[1]') AS INT),0)) female,
      SUM(COALESCE(CAST(json_extract(in_count,'$[2]') AS INT),0)) children
    FROM footfall WHERE ${baseClause} GROUP BY h ORDER BY h`, p);

  const ffHMap = new Map(ffHRows.map(r => [Number(r.h), r]));
  const overallDwellAvg = calcDwell(db, start, end).average;

  const hourly = Array.from({ length: 12 }, (_, i) => {
    const h  = 10 + i;
    const ff = ffHMap.get(h) || { male: 0, female: 0, children: 0 };
    const avg = (v: unknown) => Math.round(Number(v) / numDays);
    return {
      hour: String(h),
      footfall: { male: avg(ff.male), female: avg(ff.female), children: avg(ff.children) },
      dwell:    overallDwellAvg,
    };
  });

  return { daily, hourly };
}

export function queryPeriods(db: Database): PeriodsData {
  const now   = new Date();
  const nowTs = Math.floor(now.getTime() / 1000);

  const todayMid    = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const todayStart  = Math.floor(todayMid.getTime() / 1000);

  const dow         = now.getDay();
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const monday      = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMon, 0, 0, 0);
  const mondayStart = Math.floor(monday.getTime() / 1000);

  const lastMon      = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7, 0, 0, 0);
  const lastSun      = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 23, 59, 59);
  const lastMonStart = Math.floor(lastMon.getTime() / 1000);
  const lastSunEnd   = Math.floor(lastSun.getTime() / 1000);

  const thisMonthStart = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0).getTime() / 1000);
  const lastMonthStart = Math.floor(new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0).getTime() / 1000);
  const lastMonthEnd   = Math.floor(new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).getTime() / 1000);

  const NO_DWELL: DwellData = { average: 0, lessThan2: 0, twoTo10: 0, moreThan10: 0 };
  function periodSummary(start: number, end: number): SummaryData {
    return {
      footfall:  getFootfall(db, start, end),
      dwellTime: NO_DWELL,
    };
  }

  return {
    today:     periodSummary(todayStart,     nowTs),
    thisWeek:  periodSummary(mondayStart,    nowTs),
    lastWeek:  periodSummary(lastMonStart,   lastSunEnd),
    thisMonth: periodSummary(thisMonthStart, nowTs),
    lastMonth: periodSummary(lastMonthStart, lastMonthEnd),
  };
}

// ── Clearance analysis ────────────────────────────────────────────────────────

export interface ClearanceDayPoint {
  date: string;
  events: number;
  avgDuration: number;
}

export interface ClearanceHourPoint {
  hour: string;
  events: number;
  avgDuration: number;
}

export interface ClearanceAnalysisData {
  daily: ClearanceDayPoint[];
  hourly: ClearanceHourPoint[];
}

export function queryClearanceAnalysis(db: Database, start: number, end: number): ClearanceAnalysisData {
  // Fetch all rows in range to detect streak boundaries (clean resets a streak).
  // Extra rows before `start` might be needed to know if a streak is already open,
  // but keeping it to the range is acceptable — partial streaks at the boundary
  // are included if any of their periodic rows fall inside the range.
  const rawRows = all(db, `
    SELECT unixtime, is_occupied, is_clean, unclean_duration
    FROM clearance
    WHERE unixtime >= ? AND unixtime < ?
    ORDER BY unixtime ASC
  `, [start, end]);

  // Collapse into one event per unclean streak (same logic as getClearanceAlerts)
  const events: { unixtime: number; uncleanDuration: number }[] = [];
  let streakStart: number | null = null;
  let currentStreak: { unixtime: number; uncleanDuration: number } | null = null;

  for (const row of rawRows) {
    const ts  = Number(row.unixtime);
    const dur = Number(row.unclean_duration) || 0;
    if (Number(row.is_clean) === 1) {
      if (currentStreak) {
        events.push({ unixtime: currentStreak.unixtime, uncleanDuration: Math.max(currentStreak.uncleanDuration, dur) });
      } else if (dur > 60) {
        events.push({ unixtime: streakStart ?? ts, uncleanDuration: dur });
      }
      currentStreak = null;
      streakStart   = null;
    } else {
      if (streakStart === null) streakStart = ts;
      if (Number(row.is_occupied) !== 1 && dur > 60) {
        currentStreak = { unixtime: streakStart, uncleanDuration: dur };
      }
    }
  }
  if (currentStreak) events.push(currentStreak);

  const buckets = dateBuckets(start, end);
  const daily: ClearanceDayPoint[] = buckets.map(({ label, start: s, end: e }) => {
    const evs = events.filter(ev => ev.unixtime >= s && ev.unixtime < e);
    return {
      date: label,
      events: evs.length,
      avgDuration: evs.length > 0 ? Math.round(evs.reduce((sum, ev) => sum + ev.uncleanDuration, 0) / evs.length) : 0,
    };
  });

  const hourMap = new Map<number, { count: number; totalDur: number }>();
  for (const ev of events) {
    const h = Math.floor(((ev.unixtime + IST_OFFSET) % 86400) / 3600);
    const existing = hourMap.get(h) ?? { count: 0, totalDur: 0 };
    hourMap.set(h, { count: existing.count + 1, totalDur: existing.totalDur + ev.uncleanDuration });
  }

  const hourly: ClearanceHourPoint[] = Array.from({ length: 12 }, (_, i) => {
    const h = 10 + i;
    const d = hourMap.get(h);
    return {
      hour: `${String(h).padStart(2, '0')}:00`,
      events: d ? d.count : 0,
      avgDuration: d ? Math.round(d.totalDur / d.count) : 0,
    };
  });

  return { daily, hourly };
}

// Unused exports kept for compatibility with dbWorker
export { getLatestTs, singleTs, footfallTs, lastNDays };
