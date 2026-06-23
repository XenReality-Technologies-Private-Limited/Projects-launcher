import type { Database, SqlJsStatic } from 'sql.js';
import { idbGet, idbSet } from './idbCache';
import { all, CREATE_SCHEMA, CREATE_INDEXES } from './queryEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

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

function dateFromPath(p: string): string | null {
  const m = p.match(/(\d{4})\/(\d{2})\/(\d{2})\.db$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function resolveEntries(rawPaths: string[]): DbEntry[] {
  const today = todayIst();
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
    const url = p.startsWith('/') ? p : `/${p}`;
    entries.push({ url, canonicalDate: date, isToday: date === today, isBacklog: p.includes('backlog_') });
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
  const info    = all(srcDb, `PRAGMA table_info("${srcTable}")`);
  const srcCols = info.map(r => r.name as string);
  const hasGroup = srcCols.includes('group_in');
  const hasSolo  = srcCols.includes('solo_in');
  if (dayStart !== null) mem.run(`DELETE FROM footfall WHERE unixtime >= ${dayStart} AND unixtime <= ${dayEnd}`);
  const rows = all(srcDb, `SELECT unixtime, duration, "${inc}" ic, "${outc}" oc${hasGroup ? ', group_in' : ''}${hasSolo ? ', solo_in' : ''} FROM "${srcTable}"`);
  const stmt = mem.prepare('INSERT INTO footfall VALUES (?,?,?,?,?,?)');
  mem.run('BEGIN');
  rows.forEach(r => {
    if (isJsonArr(r.ic) && isJsonArr(r.oc))
      stmt.run([
        r.unixtime as number,
        r.duration as number,
        normJson(r.ic as string),
        normJson(r.oc as string),
        hasGroup ? ((r.group_in as number) ?? 0) : 0,
        hasSolo  ? ((r.solo_in  as number) ?? 0) : 0,
      ]);
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

      // footfall
      if (tables.includes('footfall')) {
        mergeFootfallTable(src, 'footfall', mem, dayStart, dayEnd);
      }

      // clearance (Table 1 only)
      if (tables.includes('clearance')) {
        if (dayStart !== null) mem.run(`DELETE FROM clearance WHERE unixtime >= ${dayStart} AND unixtime <= ${dayEnd}`);
        const rows = all(src, `SELECT unixtime, is_occupied, is_clean, unclean_duration FROM clearance`);
        const stmt = mem.prepare(`INSERT INTO clearance VALUES (?,?,?,?)`);
        mem.run('BEGIN');
        rows.forEach(r => stmt.run([r.unixtime as number, r.is_occupied as number, r.is_clean as number, r.unclean_duration as number]));
        mem.run('COMMIT');
        stmt.free();
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
  const rawPaths = manifest.map(m => (typeof m === 'string' ? m : m.path));
  const entries = resolveEntries(rawPaths);

  if (entries.length === 0) {
    const empty = new SQL.Database();
    empty.run(CREATE_SCHEMA);
    return empty;
  }

  const historicalEntries = entries.filter(e => !e.isToday);
  const todayEntries      = entries.filter(e => e.isToday);

  // Prefix with IST date so stale historical caches are busted daily
  const istDay  = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const histKey = historicalEntries.length ? `${istDay}:${historicalEntries.map(e => e.url).sort().join('|')}` : '';

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
      merged.run('DROP INDEX IF EXISTS idx_clearance_t');
      const todayMerged = buildMemDb(SQL, todayBuffers);
      for (const table of ['footfall', 'clearance'] as const) {
        try {
          const rows = all(todayMerged, `SELECT * FROM ${table}`);
          if (rows.length === 0) continue;
          const entry = todayEntries[0];
          if (entry.canonicalDate) {
            const dayStart = Math.floor(new Date(entry.canonicalDate + 'T00:00:00Z').getTime() / 1000);
            const dayEnd   = dayStart + 86400 - 1;
            merged.run(`DELETE FROM ${table} WHERE unixtime >= ${dayStart} AND unixtime <= ${dayEnd}`);
          }
          if (table === 'footfall') {
            const stmt = merged.prepare(`INSERT INTO footfall VALUES (?,?,?,?,?,?)`);
            merged.run('BEGIN');
            rows.forEach(r => {
              if (isJsonArr(r.in_count) && isJsonArr(r.out_count))
                stmt.run([
                  r.unixtime as number,
                  r.duration as number,
                  normJson(r.in_count as string),
                  normJson(r.out_count as string),
                  (r.group_in as number) ?? 0,
                  (r.solo_in  as number) ?? 0,
                ]);
            });
            merged.run('COMMIT');
            stmt.free();
          } else if (table === 'clearance') {
            const stmt = merged.prepare(`INSERT INTO clearance VALUES (?,?,?,?)`);
            merged.run('BEGIN');
            rows.forEach(r => stmt.run([r.unixtime as number, r.is_occupied as number, r.is_clean as number, r.unclean_duration as number]));
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
