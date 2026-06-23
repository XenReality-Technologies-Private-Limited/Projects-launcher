import type { Database, SqlJsStatic } from 'sql.js';

const DB_URL = 'https://d2uimaqek2eby3.cloudfront.net/V%20Bazaar/Bazaar%20(1).db';

let _dbPromise: Promise<Database> | null = null;

export function loadVBazaarDb(SQL: SqlJsStatic): Promise<Database> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = fetch(DB_URL)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching database`);
      return res.arrayBuffer();
    })
    .then(buf => new SQL.Database(new Uint8Array(buf)));
  return _dbPromise;
}

export function invalidateAll(): void {
  _dbPromise = null;
}
