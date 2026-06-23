import type { Database, SqlJsStatic } from 'sql.js';
import { idbGet, idbSet } from './idbCache';
import { all, CREATE_SCHEMA, CREATE_INDEXES } from './queryEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

// A manifest entry is either a plain path string or an object with a path field.
export type ManifestEntry = string | { path: string; date?: string; tables?: string[] };

interface DbEntry {
  url: string;
  canonicalDate: string | null;
  isToday: boolean;
  isBacklog: boolean;
}

// ── IST helpers ───────────────────────────────────────────────────────────────

function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().split('T')[0];
}

// ── Manifest resolution ───────────────────────────────────────────────────────

// Extract YYYY-MM-DD from a path like /kpis/2026/05/17.db or /kpis/backlog_2026/05/17.db
function dateFromPath(p: string): string | null {
  const m = p.match(/(\d{4})\/(\d{2})\/(\d{2})\.db$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function resolveEntries(rawPaths: string[]): DbEntry[] {
  const today = todayIst();

  // Dedup: backlog overrides regular for the same date.
  // Key = canonical date string.
  const byDate = new Map<string, string>();
  for (const p of rawPaths) {
    const date = dateFromPath(p);
    if (!date) continue;
    const existing = byDate.get(date);
    const isBacklog = p.includes('backlog_');
    if (!existing || isBacklog) byDate.set(date, p);
  }

  const entries: DbEntry[] = [];
  for (const [date, p] of byDate) {
    // Construct fetch URL — paths from db_writer start with /kpis/ already
    const url = p.startsWith('/') ? p : `/${p}`;
    entries.push({
      url,
      canonicalDate: date,
      isToday: date === today,
      isBacklog: p.includes('backlog_'),
    });
  }
  return entries;
}

// ── buildMemDb ────────────────────────────────────────────────────────────────

function isJsonArr(v: unknown): boolean {
  if (typeof v !== 'string') return false;
  const t = v.trim();
  if (!t.startsWith('[')) return false;
  try { JSON.parse(t); return true; } catch { return false; }
}

function normJson(s: string): string {
  try { return JSON.stringify(JSON.parse(s)); } catch { return s; }
}

function getCols(srcDb: Database, table: string): { inc: string; outc: string } {
  try {
    const info  = all(srcDb, `PRAGMA table_info("${table}")`);
    const names = info.map(r => r.name as string);
    if (names.includes('in_count')) return { inc: 'in_count', outc: 'out_count' };
    if (names.includes('in'))       return { inc: 'in',       outc: 'out' };
  } catch {}
  return { inc: 'in_count', outc: 'out_count' };
}

function mergeFootfallTable(srcDb: Database, srcTable: string, mem: Database, dayStart: number | null, dayEnd: number | null): void {
  const { inc, outc } = getCols(srcDb, srcTable);
  if (dayStart !== null) mem.run(`DELETE FROM footfall WHERE unixtime >= ${dayStart} AND unixtime <= ${dayEnd}`);
  const rows = all(srcDb, `SELECT unixtime, duration, "${inc}" ic, "${outc}" oc FROM "${srcTable}"`);
  const stmt = mem.prepare('INSERT INTO footfall VALUES (?,?,?,?)');
  mem.run('BEGIN');
  rows.forEach(r => {
    if (isJsonArr(r.ic) && isJsonArr(r.oc))
      stmt.run([r.unixtime as number, r.duration as number, normJson(r.ic as string), normJson(r.oc as string)]);
  });
  mem.run('COMMIT');
  stmt.free();
}

export function buildMemDb(SQL: SqlJsStatic, buffers: { entry: DbEntry; buf: Uint8Array }[]): Database {
  const mem = new SQL.Database();
  mem.run(CREATE_SCHEMA);

  for (const { entry, buf } of buffers) {
    const { canonicalDate } = entry;

    let dayStart: number | null = null, dayEnd: number | null = null;
    if (canonicalDate) {
      dayStart = Math.floor(new Date(canonicalDate + 'T00:00:00Z').getTime() / 1000);
      dayEnd   = dayStart + 86400 - 1;
    }

    let src: Database;
    try {
      src = new SQL.Database(buf);
    } catch (e) {
      console.warn(`[dbManager] Skip corrupted db:`, e);
      continue;
    }

    try {
      const tables = all(src, "SELECT name FROM sqlite_master WHERE type='table'").map(r => r.name as string);

      // footfall — Nikshan DBs may have footfall1 + footfall2 instead of footfall
      if (tables.includes('footfall')) {
        mergeFootfallTable(src, 'footfall', mem, dayStart, dayEnd);
      } else {
        if (tables.includes('footfall1')) mergeFootfallTable(src, 'footfall1', mem, dayStart, dayEnd);
        if (tables.includes('footfall2')) mergeFootfallTable(src, 'footfall2', mem, null, null); // don't double-delete
      }

      // passers_by
      if (tables.includes('passers_by')) {
        const { inc, outc } = getCols(src, 'passers_by');
        if (dayStart !== null) mem.run(`DELETE FROM passers_by WHERE unixtime >= ${dayStart} AND unixtime <= ${dayEnd}`);
        const rows = all(src, `SELECT unixtime, duration, "${inc}" ic, "${outc}" oc FROM passers_by`);
        const stmt = mem.prepare('INSERT INTO passers_by VALUES (?,?,?,?)');
        mem.run('BEGIN');
        rows.forEach(r => {
          if (isJsonArr(r.ic) && isJsonArr(r.oc))
            stmt.run([r.unixtime as number, r.duration as number, normJson(r.ic as string), normJson(r.oc as string)]);
        });
        mem.run('COMMIT');
        stmt.free();
      }

      // greeting — source may be named "greetings" (plural) or "greeting"
      const greetTable = tables.includes('greetings') ? 'greetings' : tables.includes('greeting') ? 'greeting' : null;
      if (greetTable) {
        const rows = all(src, `SELECT unixtime, duration, greeted, unattended FROM "${greetTable}"`);
        const stmt = mem.prepare('INSERT INTO greeting VALUES (?,?,?,?)');
        mem.run('BEGIN');
        rows.forEach(r => stmt.run([r.unixtime as number, r.duration as number, r.greeted as number, r.unattended as number]));
        mem.run('COMMIT');
        stmt.free();
      }

      // trials — source column may be in_zone or cin_zone
      if (tables.includes('trials')) {
        const tCols = all(src, 'PRAGMA table_info(trials)').map(r => r.name as string);
        const zoneCol = tCols.includes('cin_zone') ? 'cin_zone' : tCols.includes('in_zone') ? 'in_zone' : null;
        if (zoneCol) {
          if (dayStart !== null) mem.run(`DELETE FROM trials WHERE unixtime >= ${dayStart} AND unixtime <= ${dayEnd}`);
          const rows = all(src, `SELECT unixtime, cid, "${zoneCol}" z FROM trials`);
          const stmt = mem.prepare('INSERT INTO trials VALUES (?,?,?)');
          mem.run('BEGIN');
          rows.forEach(r => stmt.run([r.unixtime as number, r.cid as number, r.z as number]));
          mem.run('COMMIT');
          stmt.free();
        }
      }

      // billing
      if (tables.includes('billing')) {
        const bCols = all(src, 'PRAGMA table_info(billing)').map(r => r.name as string);
        const zoneCol = bCols.includes('cin_zone') ? 'cin_zone' : bCols.includes('in_zone') ? 'in_zone' : null;
        if (zoneCol) {
          if (dayStart !== null) mem.run(`DELETE FROM billing WHERE unixtime >= ${dayStart} AND unixtime <= ${dayEnd}`);
          const rows = all(src, `SELECT unixtime, cid, "${zoneCol}" z FROM billing`);
          const stmt = mem.prepare('INSERT INTO billing VALUES (?,?,?)');
          mem.run('BEGIN');
          rows.forEach(r => stmt.run([r.unixtime as number, r.cid as number, r.z as number]));
          mem.run('COMMIT');
          stmt.free();
        }
      }
    } catch (e) {
      console.warn(`[dbManager] Error merging db:`, e);
    } finally {
      src.close();
    }
  }

  mem.run(CREATE_INDEXES);
  return mem;
}

// ── DB fetching ───────────────────────────────────────────────────────────────

async function fetchBytes(url: string, isToday: boolean): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { cache: isToday ? 'no-store' : 'default' });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`HTTP ${res.status}`);
    }
    return new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    console.warn(`[dbManager] fetch ${url}:`, e);
    return null;
  }
}

// ── Singleton DB cache ────────────────────────────────────────────────────────

let _dbCache: Database | null = null;
let _inFlight: Promise<Database> | null = null;

export function invalidateAll(): void {
  if (_dbCache) { try { _dbCache.close(); } catch {} }
  _dbCache = null;
  _inFlight = null;
}

export function loadDb(SQL: SqlJsStatic, manifest: ManifestEntry[]): Promise<Database> {
  if (_dbCache) return Promise.resolve(_dbCache);
  if (_inFlight) return _inFlight;

  _inFlight = buildDb(SQL, manifest)
    .then(db => { _dbCache = db; return db; })
    .finally(() => { _inFlight = null; });

  return _inFlight;
}

async function buildDb(SQL: SqlJsStatic, manifest: ManifestEntry[]): Promise<Database> {
  // Normalize manifest to plain path strings
  const rawPaths = manifest.map(m => (typeof m === 'string' ? m : m.path));
  const entries = resolveEntries(rawPaths);

  if (entries.length === 0) {
    const empty = new SQL.Database();
    empty.run(CREATE_SCHEMA);
    return empty;
  }

  const historicalEntries = entries.filter(e => !e.isToday);
  const todayEntries      = entries.filter(e => e.isToday);

  // IDB cache key: sorted list of all historical URLs
  const histKey = historicalEntries.map(e => e.url).sort().join('|');

  let histBytes = histKey ? await idbGet(histKey) : null;
  let histDb: Database | null = null;

  if (histBytes) {
    try {
      histDb = new SQL.Database(histBytes);
    } catch {
      histDb = null;
      histBytes = null;
    }
  }

  if (!histDb) {
    const histBuffers: { entry: DbEntry; buf: Uint8Array }[] = [];
    await Promise.all(historicalEntries.map(async entry => {
      const buf = await fetchBytes(entry.url, false);
      if (buf) histBuffers.push({ entry, buf });
    }));
    if (histBuffers.length > 0) {
      histDb = buildMemDb(SQL, histBuffers);
      idbSet(histKey, histDb.export()).catch(() => {});
    }
  }

  let merged: Database;
  if (histDb) {
    const histExport = histDb.export();
    merged = new SQL.Database(histExport);
    histDb.close();
  } else {
    merged = new SQL.Database();
    merged.run(CREATE_SCHEMA);
  }

  if (todayEntries.length > 0) {
    const todayBuffers: { entry: DbEntry; buf: Uint8Array }[] = [];
    await Promise.all(todayEntries.map(async entry => {
      const buf = await fetchBytes(entry.url, true);
      if (buf) todayBuffers.push({ entry, buf });
    }));
    if (todayBuffers.length > 0) {
      merged.run('DROP INDEX IF EXISTS idx_footfall_t');
      merged.run('DROP INDEX IF EXISTS idx_passersby_t');
      merged.run('DROP INDEX IF EXISTS idx_greeting_t');
      merged.run('DROP INDEX IF EXISTS idx_trials_t');
      merged.run('DROP INDEX IF EXISTS idx_billing_t');
      const todayMerged = buildMemDb(SQL, todayBuffers);
      for (const table of ['footfall', 'passers_by', 'greeting', 'trials', 'billing'] as const) {
        try {
          const rows = all(todayMerged, `SELECT * FROM ${table}`);
          if (rows.length === 0) continue;
          const entry = todayEntries[0];
          if (entry.canonicalDate && (table === 'footfall' || table === 'passers_by' || table === 'trials' || table === 'billing')) {
            const dayStart = Math.floor(new Date(entry.canonicalDate + 'T00:00:00Z').getTime() / 1000);
            const dayEnd   = dayStart + 86400 - 1;
            merged.run(`DELETE FROM ${table} WHERE unixtime >= ${dayStart} AND unixtime <= ${dayEnd}`);
          }
          if (table === 'footfall' || table === 'passers_by') {
            const stmt = merged.prepare(`INSERT INTO ${table} VALUES (?,?,?,?)`);
            merged.run('BEGIN');
            rows.forEach(r => {
              if (isJsonArr(r.in_count) && isJsonArr(r.out_count))
                stmt.run([r.unixtime as number, r.duration as number, normJson(r.in_count as string), normJson(r.out_count as string)]);
            });
            merged.run('COMMIT');
            stmt.free();
          } else if (table === 'greeting') {
            const stmt = merged.prepare('INSERT INTO greeting VALUES (?,?,?,?)');
            merged.run('BEGIN');
            rows.forEach(r => stmt.run([r.unixtime as number, r.duration as number, r.greeted as number, r.unattended as number]));
            merged.run('COMMIT');
            stmt.free();
          } else {
            const stmt = merged.prepare(`INSERT INTO ${table} VALUES (?,?,?)`);
            merged.run('BEGIN');
            rows.forEach(r => stmt.run([r.unixtime as number, r.cid as number, r.cin_zone as number]));
            merged.run('COMMIT');
            stmt.free();
          }
        } catch {}
      }
      todayMerged.close();
      merged.run(CREATE_INDEXES);
    }
  }

  return merged;
}
