// Main-thread proxy: creates a singleton Web Worker and maps requests to Promises.

import type { WorkerRequest, WorkerResponse } from './dbWorker';
import type {
  SummaryData, TrendPoint, HourlyPoint,
  AnalysisData, AnalysisDetailData, PeriodsData,
} from '../api';

let _worker: Worker | null = null;
const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();
let _manifest: unknown[] | null = null;
let _manifestPromise: Promise<unknown[]> | null = null;

function getWorker(): Worker {
  if (_worker) return _worker;
  _worker = new Worker(new URL('./dbWorker.ts', import.meta.url));
  _worker.onmessage = (evt: MessageEvent<WorkerResponse>) => {
    const p = pending.get(evt.data.id);
    if (!p) return;
    pending.delete(evt.data.id);
    if (evt.data.ok) p.resolve(evt.data.data);
    else p.reject(new Error(evt.data.error || 'Worker error'));
  };
  _worker.onerror = (e) => {
    console.error('[dbWorker]', e);
    for (const p of pending.values()) p.reject(e);
    pending.clear();
  };
  return _worker;
}

async function getManifest(): Promise<unknown[]> {
  if (_manifest) return _manifest;
  if (_manifestPromise) return _manifestPromise;
  _manifestPromise = fetch('/kpis/index.json', { cache: 'no-store' })
    .then(r => r.json())
    .then(parsed => {
      // Nikshan format: { "dbs": ["/kpis/YYYY/MM/DD.db", ...] }
      _manifest = Array.isArray(parsed) ? parsed : (parsed.dbs || parsed.items || []);
      return _manifest!;
    });
  return _manifestPromise;
}

export async function invalidateDbCache(): Promise<void> {
  _manifest = null;
  _manifestPromise = null;
  const worker = getWorker();
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: () => resolve(), reject });
    worker.postMessage({ id, type: 'invalidate' } as WorkerRequest);
  });
}

async function query<T>(type: WorkerRequest['type'], start?: number, end?: number): Promise<T> {
  const worker   = getWorker();
  const manifest = await getManifest();
  const id = Math.random().toString(36).slice(2);
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    const req: WorkerRequest = { id, type, start, end, manifest: manifest as never[] };
    worker.postMessage(req);
  });
}

export const dbApi = {
  summary(start?: number, end?: number) {
    return query<SummaryData>('summary', start, end);
  },

  trend(start?: number, end?: number) {
    const nowSec = Math.floor(Date.now() / 1000);
    return query<TrendPoint[]>('trend', start ?? nowSec - 10 * 86400, end ?? nowSec);
  },

  hourly(start?: number, end?: number) {
    return query<HourlyPoint[]>('hourly', start, end);
  },

  analysis() {
    return query<AnalysisData>('analysis');
  },

  analysisDetail(start: number, end: number) {
    return query<AnalysisDetailData>('analysisDetail', start, end);
  },

  periods() {
    return query<PeriodsData>('periods');
  },
};
