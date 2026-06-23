// IndexedDB cache for merged historical SQLite bytes.
// Historical data (all dates except today) is cached forever — the key changes when a new day
// is added (new URL = new key = cache miss = rebuild + re-save), giving automatic daily refresh.
// Today's file is never stored here — it is always fetched fresh.

const IDB_NAME    = 'kpi-db-cache';
const IDB_VERSION = 3;
const IDB_STORE   = 'merged-dbs';

let _db: IDBDatabase | null = null;

async function openIdb(): Promise<IDBDatabase> {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror   = () => reject(req.error);
  });
}

export async function idbGet(key: string): Promise<Uint8Array | null> {
  try {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => reject(req.error);
    });
  } catch { return null; }
}

export async function idbSet(key: string, value: Uint8Array): Promise<void> {
  try {
    const db = await openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx  = db.transaction(IDB_STORE, 'readwrite');
      const req = tx.objectStore(IDB_STORE).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[idbCache] write failed:', e);
  }
}
