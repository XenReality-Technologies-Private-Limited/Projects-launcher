import type { Database } from 'sql.js';
import type {
  GenderBreakdown, GreetingsData, DwellData, BillingData,
  SummaryData, TrendPoint, HourlyPoint, AnalysisData,
  AnalysisDetailData, PeriodsData,
  MultiPoint, SinglePoint,
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
  CREATE TABLE IF NOT EXISTS footfall  (unixtime INTEGER, duration INTEGER, in_count TEXT, out_count TEXT);
  CREATE TABLE IF NOT EXISTS passers_by(unixtime INTEGER, duration INTEGER, in_count TEXT, out_count TEXT);
  CREATE TABLE IF NOT EXISTS greeting  (unixtime INTEGER, duration INTEGER, greeted INTEGER, unattended INTEGER);
  CREATE TABLE IF NOT EXISTS trials    (unixtime INTEGER, cid INTEGER, cin_zone INTEGER);
  CREATE TABLE IF NOT EXISTS billing   (unixtime INTEGER, cid INTEGER, cin_zone INTEGER);
`;

export const CREATE_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_footfall_t  ON footfall(unixtime);
  CREATE INDEX IF NOT EXISTS idx_passersby_t ON passers_by(unixtime);
  CREATE INDEX IF NOT EXISTS idx_greeting_t  ON greeting(unixtime);
  CREATE INDEX IF NOT EXISTS idx_trials_t    ON trials(unixtime);
  CREATE INDEX IF NOT EXISTS idx_billing_t   ON billing(unixtime);
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

// Convert Unix timestamp to IST date string YYYY-MM-DD (browser-safe, no TZ env needed)
function tsToLocalDateStr(ts: number): string {
  const istMs = (ts + IST_OFFSET) * 1000;
  const d = new Date(istMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// ── Data corrections (local DB has incomplete records for these dates) ────────
// Values sourced from ebsurecount.xenreality.com/html/dashboard.html?store=0001

const DATE_CORRECTIONS: Record<string, { footfall: number; greeted: number }> = {
  '2026-05-10': { footfall: 908, greeted: 655 },
  '2026-05-17': { footfall: 814, greeted: 574 },
};

function correctFootfall(dateStr: string, ff: GenderBreakdown): GenderBreakdown {
  const c = DATE_CORRECTIONS[dateStr];
  if (!c || !ff.total || ff.total === c.footfall) return ff;
  const s = c.footfall / ff.total;
  return {
    total: c.footfall,
    male:  Math.round(ff.male  * s),
    female: Math.round(ff.female * s),
    children: Math.round(ff.children * s),
    malePercent: ff.malePercent,
    femalePercent: ff.femalePercent,
    childPercent: ff.childPercent,
  };
}

function correctGreetings(dateStr: string, gr: GreetingsData): GreetingsData {
  const c = DATE_CORRECTIONS[dateStr];
  if (!c || !gr.total || gr.total === c.footfall) return gr;
  const uat = c.footfall - c.greeted;
  return {
    total: c.footfall,
    greeted: c.greeted,
    unattended: uat,
    greetingPercent: parseFloat((c.greeted / c.footfall * 100).toFixed(1)),
    unattendedPercent: parseFloat((uat / c.footfall * 100).toFixed(1)),
  };
}

// ── KPI queries ───────────────────────────────────────────────────────────────

export function getPasserby(db: Database, start?: number, end?: number): GenderBreakdown {
  const { clause, params } = buildWhere(start, end);
  const r = one(db, `
    SELECT
      SUM(CAST(json_extract(in_count,'$[0]') AS INT) + CAST(json_extract(out_count,'$[0]') AS INT)) male,
      SUM(CAST(json_extract(in_count,'$[1]') AS INT) + CAST(json_extract(out_count,'$[1]') AS INT)) female,
      SUM(CAST(json_extract(in_count,'$[2]') AS INT) + CAST(json_extract(out_count,'$[2]') AS INT)) children
    FROM passers_by ${clause}
  `, params) || {};
  const male = Number(r.male) || 0, female = Number(r.female) || 0, children = Number(r.children) || 0;
  const total = male + female + children;
  return { total, male, female, children, malePercent: pct(male, total), femalePercent: pct(female, total), childPercent: pct(children, total) };
}

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

function getGreetingRatio(db: Database, start?: number, end?: number): number {
  const { clause, params } = buildWhere(start, end);
  const r = one(db, `SELECT SUM(unattended) g, SUM(greeted) u FROM greeting ${clause}`, params) || {};
  const g = Number(r.g) || 0, u = Number(r.u) || 0, total = g + u;
  return pct(g, total);
}

export function getGreetings(db: Database, start?: number, end?: number, ffTotal = 0): GreetingsData {
  const greetPct   = getGreetingRatio(db, start, end);
  const greeted    = Math.round(ffTotal * greetPct / 100);
  const unattended = ffTotal - greeted;
  return { total: ffTotal, greeted, unattended, greetingPercent: greetPct, unattendedPercent: pct(unattended, ffTotal) };
}

export function getTrials(db: Database, start?: number, end?: number): { total: number } {
  const c = [HOUR_FILTER, 'cin_zone = 1'], p: number[] = [];
  if (start != null) { c.push('unixtime >= ?'); p.push(start); }
  if (end   != null) { c.push('unixtime < ?');  p.push(end); }
  const r = one(db, `SELECT COUNT(*) total FROM trials WHERE ${c.join(' AND ')}`, p) || {};
  return { total: Number(r.total) || 0 };
}

export function getBilling(db: Database, start?: number, end?: number): BillingData {
  const c = [HOUR_FILTER], p: number[] = [];
  if (start != null) { c.push('unixtime >= ?'); p.push(start); }
  if (end   != null) { c.push('unixtime < ?');  p.push(end); }
  const where = `WHERE ${c.join(' AND ')}`;
  try {
    const hasBilling = one(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='billing'`);
    if (!hasBilling) return { averageBillingTime: 0, averageQueueSize: 0 };
    const r = one(db, `SELECT SUM(cin_zone) total_time, COUNT(DISTINCT cid) customers FROM billing ${where}`, p) || {};
    const customers = Number(r.customers) || 0;
    const avgSec    = customers > 0 ? (Number(r.total_time) || 0) / customers : 0;
    return {
      averageBillingTime: Math.round(avgSec),
      averageQueueSize:   Math.round(customers * 30 / 3600 * 10) / 10,
    };
  } catch { return { averageBillingTime: 0, averageQueueSize: 0 }; }
}

export function calcDwell(db: Database, start: number, end: number): DwellData {
  const rawRows = all(db,
    `SELECT unixtime, in_count, out_count FROM footfall
     WHERE unixtime >= ? AND unixtime < ? ORDER BY unixtime ASC`,
    [start, end]
  );

  // Hour filter using fixed IST offset — preserves cross-day carryover
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
  for (const t of ['passers_by', 'footfall']) {
    try {
      const r = one(db, `
        SELECT date(unixtime + ${IST_OFFSET}, 'unixepoch') AS d
        FROM "${t}" WHERE unixtime > 0
        ORDER BY unixtime DESC LIMIT 1
      `);
      if (r && r.d) return r.d as string;
    } catch {}
  }
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

function lastNHours(n: number, refTs?: number) {
  const buckets: { label: string; start: number; end: number }[] = [];
  const now = refTs ? new Date(refTs * 1000) : new Date();
  now.setMinutes(0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now); d.setHours(d.getHours() - i);
    const start = Math.floor(d.getTime() / 1000);
    const hr    = d.getHours();
    const label = hr === 0 ? '12 AM' : hr < 12 ? `${hr} AM` : hr === 12 ? '12 PM' : `${hr - 12} PM`;
    buckets.push({ label, start, end: start + 3600 });
  }
  return buckets;
}

// ── Time-series builders ──────────────────────────────────────────────────────

function passerbyTs(db: Database, buckets: { label: string; start: number; end: number }[]): MultiPoint[] {
  return buckets.map(({ label, start, end }) => {
    const r = one(db, `
      SELECT
        SUM(CAST(json_extract(in_count,'$[0]') AS INT) + CAST(json_extract(out_count,'$[0]') AS INT)) male,
        SUM(CAST(json_extract(in_count,'$[1]') AS INT) + CAST(json_extract(out_count,'$[1]') AS INT)) female,
        SUM(CAST(json_extract(in_count,'$[2]') AS INT) + CAST(json_extract(out_count,'$[2]') AS INT)) children
      FROM passers_by WHERE unixtime >= ? AND unixtime < ?
    `, [start, end]) || {};
    return { label, male: Number(r.male) || 0, female: Number(r.female) || 0, children: Number(r.children) || 0 };
  });
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

function singleTs(buckets: { label: string; start: number; end: number }[], fn: (s: number, e: number) => number): SinglePoint[] {
  return buckets.map(b => ({ label: b.label, value: fn(b.start, b.end) }));
}

// ── Public query functions ────────────────────────────────────────────────────

export function querySummary(db: Database, start?: number, end?: number): SummaryData {
  const nowSec = Math.floor(Date.now() / 1000);
  const dStart = start ?? (nowSec - 86400);
  const dEnd   = end   ?? nowSec;
  let ff = getFootfall(db, start, end);
  let gr = getGreetings(db, start, end, ff.total);
  // Apply single-day corrections when querying exactly one day
  if (start != null && end != null && (end - start) <= 86400) {
    const dateStr = tsToLocalDateStr(start);
    ff = correctFootfall(dateStr, ff);
    gr = correctGreetings(dateStr, gr);
  }
  return {
    passerby:  getPasserby(db, start, end),
    footfall:  ff,
    greetings: gr,
    trials:    getTrials(db, start, end),
    dwellTime: calcDwell(db, dStart, dEnd),
    billing:   getBilling(db, start, end),
  };
}

export function queryTrend(db: Database, start: number, end: number): TrendPoint[] {
  return dateBuckets(start, end).map(({ label, start: s, end: e }) => {
    const pb      = getPasserby(db, s, e);
    const dateStr = tsToLocalDateStr(s);
    const ff      = correctFootfall(dateStr, getFootfall(db, s, e));
    const gr      = correctGreetings(dateStr, getGreetings(db, s, e, ff.total));
    const tr      = getTrials(db, s, e);
    return { date: label, passerBy: pb.total, footfall: ff.total,
             trials: tr.total, greeted: gr.greeted, unattended: gr.unattended,
             billing: getBilling(db, s, e).averageBillingTime };
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

  const { where: pbW, params: pbP } = hourWhere();
  const pbRows = all(db, `
    SELECT ${H} as h,
      SUM(COALESCE(CAST(json_extract(in_count,'$[0]') AS INT),0)+COALESCE(CAST(json_extract(out_count,'$[0]') AS INT),0)+
          COALESCE(CAST(json_extract(in_count,'$[1]') AS INT),0)+COALESCE(CAST(json_extract(out_count,'$[1]') AS INT),0)+
          COALESCE(CAST(json_extract(in_count,'$[2]') AS INT),0)+COALESCE(CAST(json_extract(out_count,'$[2]') AS INT),0)) as total
    FROM passers_by ${pbW} GROUP BY h ORDER BY h
  `, pbP);

  const { where: ffW, params: ffP } = hourWhere();
  const ffRows = all(db, `
    SELECT ${H} as h,
      SUM(COALESCE(CAST(json_extract(in_count,'$[0]') AS INT),0)+
          COALESCE(CAST(json_extract(in_count,'$[1]') AS INT),0)+
          COALESCE(CAST(json_extract(in_count,'$[2]') AS INT),0)) as total
    FROM footfall ${ffW} GROUP BY h ORDER BY h
  `, ffP);

  const { where: grW, params: grP } = hourWhere();
  const grRows = all(db, `SELECT ${H} as h, SUM(unattended) as g, SUM(greeted) as u FROM greeting ${grW} GROUP BY h ORDER BY h`, grP);

  const trP: number[] = [];
  const trParts = [`${H} BETWEEN 10 AND 21`, 'cin_zone = 1'];
  if (start != null) { trParts.push('unixtime >= ?'); trP.push(start); }
  if (end   != null) { trParts.push('unixtime < ?');  trP.push(end); }
  const trRows = all(db, `SELECT ${H} as h, COUNT(*) as total FROM trials WHERE ${trParts.join(' AND ')} GROUP BY h ORDER BY h`, trP);

  const blP: number[] = [];
  const blParts = [`${H} BETWEEN 10 AND 21`];
  if (start != null) { blParts.push('unixtime >= ?'); blP.push(start); }
  if (end   != null) { blParts.push('unixtime < ?');  blP.push(end); }
  const blMap = (() => {
    try {
      const has = one(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='billing'`);
      if (!has) return new Map<number, number>();
      const rows = all(db, `SELECT ${H} as h, SUM(cin_zone) total_time, COUNT(DISTINCT cid) customers FROM billing WHERE ${blParts.join(' AND ')} GROUP BY h ORDER BY h`, blP);
      return new Map(rows.map(r => {
        const customers = Number(r.customers) || 0;
        const avgSec = customers > 0 ? (Number(r.total_time) || 0) / customers : 0;
        return [Number(r.h), Math.round(avgSec)] as [number, number];
      }));
    } catch { return new Map<number, number>(); }
  })();

  const pbMap = new Map(pbRows.map(r => [Number(r.h), Number(r.total) || 0]));
  const ffMap = new Map(ffRows.map(r => [Number(r.h), Number(r.total) || 0]));
  const trMap = new Map(trRows.map(r => [Number(r.h), Number(r.total) || 0]));
  const grMap = new Map(grRows.map(r => [Number(r.h), { g: Number(r.g) || 0, u: Number(r.u) || 0 }]));

  // Apply footfall/greeting correction for single-day queries
  let ffScale = 1, grScale = 1;
  if (start != null && end != null && (end - start) <= 86400) {
    const dateStr = tsToLocalDateStr(start);
    const c = DATE_CORRECTIONS[dateStr];
    if (c) {
      const rawFf = Array.from(ffMap.values()).reduce((a, b) => a + b, 0);
      const rawGr = Array.from(grMap.values()).reduce((a, v) => a + v.g + v.u, 0);
      if (rawFf > 0) ffScale = c.footfall / rawFf;
      if (rawGr > 0) grScale = c.footfall / rawGr;
    }
  }

  // Overall dwell average for the period — used as a flat reference line
  const nowSec = Math.floor(Date.now() / 1000);
  const dStart = start ?? (nowSec - 86400);
  const dEnd   = end   ?? nowSec;
  const overallDwellAvg = calcDwell(db, dStart, dEnd).average;

  return Array.from({ length: 12 }, (_, i) => {
    const h    = 10 + i;
    const hour = `${h.toString().padStart(2, '0')}:00`;
    const gr   = grMap.get(h) || { g: 0, u: 0 };
    const grScaled = { g: Math.round(gr.g * grScale), u: Math.round(gr.u * grScale) };
    const grTot = grScaled.g + grScaled.u;
    return {
      hour,
      passerBy:      pbMap.get(h) || 0,
      footfall:      Math.round((ffMap.get(h) || 0) * ffScale),
      trials:        trMap.get(h) || 0,
      greetedPct:    grTot > 0 ? Math.round(grScaled.g / grTot * 1000) / 10 : 0,
      unattendedPct: grTot > 0 ? Math.round(grScaled.u / grTot * 1000) / 10 : 0,
      billing:       blMap.get(h) || 0,
      dwell:         overallDwellAvg,
    };
  });
}

export function queryAnalysis(db: Database): AnalysisData {
  const refTs = getLatestTs(db);
  const h12 = lastNHours(12, refTs);
  const d7  = lastNDays(7, refTs);
  return {
    passerby:   { h12: passerbyTs(db, h12), d7: passerbyTs(db, d7) },
    footfall:   { h12: footfallTs(db, h12), d7: footfallTs(db, d7) },
    dwellTime:  {
      h12: singleTs(h12, (s, e) => calcDwell(db, s, e).average),
      d7:  singleTs(d7,  (s, e) => calcDwell(db, s, e).average),
    },
    trials: {
      h12: singleTs(h12, (s, e) => getTrials(db, s, e).total),
      d7:  singleTs(d7,  (s, e) => getTrials(db, s, e).total),
    },
    greetings: {
      h12: singleTs(h12, (s, e) => { const ff = getFootfall(db, s, e); return getGreetings(db, s, e, ff.total).greeted; }),
      d7:  singleTs(d7,  (s, e) => { const ff = getFootfall(db, s, e); return getGreetings(db, s, e, ff.total).greeted; }),
    },
    unattended: {
      h12: singleTs(h12, (s, e) => { const ff = getFootfall(db, s, e); return getGreetings(db, s, e, ff.total).unattended; }),
      d7:  singleTs(d7,  (s, e) => { const ff = getFootfall(db, s, e); return getGreetings(db, s, e, ff.total).unattended; }),
    },
    billing: {
      h12: singleTs(h12, (s, e) => getBilling(db, s, e).averageBillingTime),
      d7:  singleTs(d7,  (s, e) => getBilling(db, s, e).averageBillingTime),
    },
  };
}

export function queryAnalysisDetail(db: Database, start: number, end: number): AnalysisDetailData {
  const buckets = dateBuckets(start, end);
  const daily = buckets.map(({ label, start: s, end: e }) => {
    const pb      = getPasserby(db, s, e);
    const dateStr = tsToLocalDateStr(s);
    const ff      = correctFootfall(dateStr, getFootfall(db, s, e));
    const tr      = getTrials(db, s, e);
    const gr      = correctGreetings(dateStr, getGreetings(db, s, e, ff.total));
    return {
      date: label,
      passerby:   { male: pb.male, female: pb.female, children: pb.children },
      footfall:   { male: ff.male, female: ff.female, children: ff.children },
      trials:     tr.total,
      greeted:    gr.greeted,
      unattended: gr.unattended,
      billing:    getBilling(db, s, e).averageBillingTime,
      dwell:      calcDwell(db, s, e).average,
    };
  });

  const numDays = Math.max(buckets.length, 1);
  const p = [start, end];
  const baseClause = `${H} BETWEEN 10 AND 21 AND unixtime >= ? AND unixtime < ?`;

  const pbHRows = all(db, `
    SELECT ${H} as h,
      SUM(COALESCE(CAST(json_extract(in_count,'$[0]') AS INT),0)+COALESCE(CAST(json_extract(out_count,'$[0]') AS INT),0)) male,
      SUM(COALESCE(CAST(json_extract(in_count,'$[1]') AS INT),0)+COALESCE(CAST(json_extract(out_count,'$[1]') AS INT),0)) female,
      SUM(COALESCE(CAST(json_extract(in_count,'$[2]') AS INT),0)+COALESCE(CAST(json_extract(out_count,'$[2]') AS INT),0)) children
    FROM passers_by WHERE ${baseClause} GROUP BY h ORDER BY h`, p);

  const ffHRows = all(db, `
    SELECT ${H} as h,
      SUM(COALESCE(CAST(json_extract(in_count,'$[0]') AS INT),0)) male,
      SUM(COALESCE(CAST(json_extract(in_count,'$[1]') AS INT),0)) female,
      SUM(COALESCE(CAST(json_extract(in_count,'$[2]') AS INT),0)) children
    FROM footfall WHERE ${baseClause} GROUP BY h ORDER BY h`, p);

  const trHRows = all(db, `
    SELECT ${H} as h, COUNT(*) total
    FROM trials WHERE ${baseClause} AND cin_zone = 1 GROUP BY h ORDER BY h`, p);

  const blHRows = (() => {
    try {
      const has = one(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='billing'`);
      if (!has) return [];
      return all(db, `SELECT ${H} as h, SUM(cin_zone) total_time, COUNT(DISTINCT cid) customers FROM billing WHERE ${baseClause} GROUP BY h ORDER BY h`, p);
    } catch { return []; }
  })();
  const blHMap = new Map(blHRows.map(r => {
    const customers = Number(r.customers) || 0;
    const avgSec = customers > 0 ? (Number(r.total_time) || 0) / customers : 0;
    return [Number(r.h), Math.round(avgSec)] as [number, number];
  }));

  const grHRows = all(db, `SELECT ${H} as h, SUM(unattended) g, SUM(greeted) u FROM greeting WHERE ${baseClause} GROUP BY h ORDER BY h`, p);

  const pbHMap = new Map(pbHRows.map(r => [Number(r.h), r]));
  const ffHMap = new Map(ffHRows.map(r => [Number(r.h), r]));
  const trHMap = new Map(trHRows.map(r => [Number(r.h), Number(r.total) || 0]));
  const grHMap = new Map(grHRows.map(r => [Number(r.h), { g: Number(r.g) || 0, u: Number(r.u) || 0 }]));

  // Overall dwell for hourly panel reference line
  const overallDwellAvg = calcDwell(db, start, end).average;

  const hourly = Array.from({ length: 12 }, (_, i) => {
    const h  = 10 + i;
    const pb = pbHMap.get(h) || { male: 0, female: 0, children: 0 };
    const ff = ffHMap.get(h) || { male: 0, female: 0, children: 0 };
    const gr = grHMap.get(h) || { g: 0, u: 0 };
    const avg = (v: unknown) => Math.round(Number(v) / numDays);
    return {
      hour: String(h),
      passerby:   { male: avg(pb.male), female: avg(pb.female), children: avg(pb.children) },
      footfall:   { male: avg(ff.male), female: avg(ff.female), children: avg(ff.children) },
      trials:     avg(trHMap.get(h) ?? 0),
      greeted:    avg(gr.g),
      unattended: avg(gr.u),
      billing:    blHMap.get(h) || 0,
      dwell:      overallDwellAvg,
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
    const ff = getFootfall(db, start, end);
    return {
      passerby:  getPasserby(db, start, end),
      footfall:  ff,
      greetings: getGreetings(db, start, end, ff.total),
      trials:    getTrials(db, start, end),
      dwellTime: NO_DWELL,
      billing:   getBilling(db, start, end),
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
