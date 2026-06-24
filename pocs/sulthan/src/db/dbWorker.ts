// Classic Web Worker — sql.js is loaded via importScripts from /sql-wasm.js (public asset)
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ManifestEntry } from './dbManager';
import { loadDb, invalidateAll } from './dbManager';
import {
  querySummary, queryTrend, queryHourly,
  queryAnalysis, queryAnalysisDetail, queryPeriods,
} from './queryEngine';

export type { ManifestEntry };

export type QueryType = 'summary' | 'trend' | 'hourly' | 'analysis' | 'analysisDetail' | 'periods' | 'invalidate';

export interface WorkerRequest {
  id: string;
  type: QueryType;
  start?: number;
  end?: number;
  manifest?: ManifestEntry[];
}

export interface WorkerResponse {
  id: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}

declare let initSqlJs: (config: { locateFile: () => string }) => Promise<any>;
declare function importScripts(...urls: string[]): void;
importScripts('/sql-wasm.js');

let SQL: any = null;
let manifest: ManifestEntry[] = [];

async function initSql(): Promise<any> {
  if (SQL) return SQL;
  SQL = await initSqlJs({ locateFile: (file: string) => `${import.meta.env.BASE_URL}${file}` });
  return SQL;
}

async function handleRequest(req: WorkerRequest): Promise<void> {
  const sql = await initSql();

  if (req.type === 'invalidate') {
    invalidateAll();
    (self as any).postMessage({ id: req.id, ok: true } as WorkerResponse);
    return;
  }

  if (req.manifest && req.manifest.length) manifest = req.manifest;

  try {
    const db = await loadDb(sql, manifest);
    let data: unknown;

    switch (req.type) {
      case 'summary':
        data = querySummary(db, req.start, req.end);
        break;
      case 'trend':
        data = queryTrend(db, req.start ?? (Math.floor(Date.now() / 1000) - 10 * 86400), req.end ?? Math.floor(Date.now() / 1000));
        break;
      case 'hourly':
        data = queryHourly(db, req.start, req.end);
        break;
      case 'analysis':
        data = queryAnalysis(db);
        break;
      case 'analysisDetail':
        if (req.start == null || req.end == null) throw new Error('start and end required for analysisDetail');
        data = queryAnalysisDetail(db, req.start, req.end);
        break;
      case 'periods':
        data = queryPeriods(db);
        break;
      default:
        throw new Error(`Unknown query type: ${req.type}`);
    }

    (self as any).postMessage({ id: req.id, ok: true, data } as WorkerResponse);
  } catch (e) {
    (self as any).postMessage({ id: req.id, ok: false, error: String(e) } as WorkerResponse);
  }
}

(self as any).onmessage = (evt: MessageEvent<WorkerRequest>) => {
  handleRequest(evt.data).catch(e => {
    (self as any).postMessage({ id: evt.data.id, ok: false, error: String(e) } as WorkerResponse);
  });
};
