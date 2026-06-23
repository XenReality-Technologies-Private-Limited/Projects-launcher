import type { SqlJsStatic } from 'sql.js';
import { loadDb, invalidateAll, type ManifestEntry } from './dbManager';
import {
  querySummary,
  queryTrend,
  queryHourly,
  queryAnalysisDetail,
  queryPeriods,
  getClearanceState,
  getClearanceStates,
  getClearanceAlerts,
  queryClearanceAnalysis,
  getFootfallStats,
} from './queryEngine';

declare let initSqlJs: (config: { locateFile: () => string }) => Promise<SqlJsStatic>;
declare function importScripts(...urls: string[]): void;
importScripts('/sql-wasm.js');

let SQL: SqlJsStatic | null = null;
let manifest: ManifestEntry[] = [];

async function getSQL(): Promise<SqlJsStatic> {
  if (!SQL) {
    SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
  }
  return SQL;
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  const id  = msg.id;

  try {
    const sql = await getSQL();

    if (msg.type === 'setManifest') {
      manifest = msg.manifest;
      invalidateAll();
      self.postMessage({ id, result: null });
      return;
    }

    if (msg.type === 'refreshDb') {
      invalidateAll();
      self.postMessage({ id, result: null });
      return;
    }

    const db = await loadDb(sql, manifest);

    switch (msg.type) {
      case 'summary':
        self.postMessage({ id, result: querySummary(db, msg.start, msg.end) });
        break;
      case 'trend':
        self.postMessage({ id, result: queryTrend(db, msg.start, msg.end) });
        break;
      case 'hourly':
        self.postMessage({ id, result: queryHourly(db, msg.start, msg.end) });
        break;
      case 'analysisDetail':
        self.postMessage({ id, result: queryAnalysisDetail(db, msg.start, msg.end) });
        break;
      case 'periods':
        self.postMessage({ id, result: queryPeriods(db) });
        break;
      case 'clearanceState':
        self.postMessage({ id, result: getClearanceState(db) });
        break;
      case 'clearanceStates':
        self.postMessage({ id, result: getClearanceStates(db) });
        break;
      case 'clearanceAlerts':
        self.postMessage({ id, result: getClearanceAlerts(db, msg.start, msg.end) });
        break;
      case 'clearanceAnalysis':
        self.postMessage({ id, result: queryClearanceAnalysis(db, msg.start, msg.end) });
        break;
      case 'footfallStats':
        self.postMessage({ id, result: getFootfallStats(db, msg.start, msg.end) });
        break;
      default:
        self.postMessage({ id, error: `Unknown type: ${msg.type}` });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ id, error: message });
  }
};
