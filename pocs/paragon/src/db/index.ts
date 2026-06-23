import type { ManifestEntry } from './dbManager';
import type { ClearanceState, ClearanceTableState, ClearanceAlert, FootfallStats } from '../api';

// ── Worker singleton ──────────────────────────────────────────────────────────

let _worker: Worker | null = null;
const _pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();

function getWorker(): Worker {
  if (_worker) return _worker;
  _worker = new Worker(new URL('./dbWorker.ts', import.meta.url));
  _worker.onmessage = (e: MessageEvent) => {
    const { id, result, error } = e.data;
    const p = _pending.get(id);
    if (!p) return;
    _pending.delete(id);
    if (error) p.reject(new Error(error));
    else p.resolve(result);
  };
  return _worker;
}

function call<T>(type: string, extra: Record<string, unknown> = {}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = Math.random().toString(36).slice(2);
    _pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    getWorker().postMessage({ id, type, ...extra });
  });
}

// ── Manifest management ───────────────────────────────────────────────────────

async function fetchManifest(): Promise<ManifestEntry[]> {
  try {
    const res = await fetch('/kpis/index.json', { cache: 'no-store' });
    if (!res.ok) return [];
    const json = await res.json();
    // db_writer.py writes {"dbs": [...]}; handle both that and a bare array
    return Array.isArray(json) ? json : (json.dbs ?? []);
  } catch {
    return [];
  }
}

let _manifestPromise: Promise<void> | null = null;

async function ensureManifest(): Promise<void> {
  if (_manifestPromise) return _manifestPromise;
  _manifestPromise = (async () => {
    const manifest = await fetchManifest();
    await call('setManifest', { manifest });
  })();
  return _manifestPromise;
}

// ── Public API ────────────────────────────────────────────────────────────────

export const dbApi = {
  async summary(start?: number, end?: number) {
    await ensureManifest();
    return call<ReturnType<typeof import('./queryEngine').querySummary>>('summary', { start, end });
  },

  async trend(start?: number, end?: number) {
    await ensureManifest();
    return call<ReturnType<typeof import('./queryEngine').queryTrend>>('trend', { start, end });
  },

  async hourly(start?: number, end?: number) {
    await ensureManifest();
    return call<ReturnType<typeof import('./queryEngine').queryHourly>>('hourly', { start, end });
  },

  async analysisDetail(start: number, end: number) {
    await ensureManifest();
    return call<ReturnType<typeof import('./queryEngine').queryAnalysisDetail>>('analysisDetail', { start, end });
  },

  async periods() {
    await ensureManifest();
    return call<ReturnType<typeof import('./queryEngine').queryPeriods>>('periods');
  },

  async clearanceState(): Promise<ClearanceState | null> {
    await ensureManifest();
    return call<ClearanceState | null>('clearanceState');
  },

  async clearanceStates(): Promise<ClearanceTableState[]> {
    await ensureManifest();
    return call<ClearanceTableState[]>('clearanceStates');
  },

  async clearanceAlerts(start?: number, end?: number): Promise<ClearanceAlert[]> {
    await ensureManifest();
    return call<ClearanceAlert[]>('clearanceAlerts', { start, end });
  },

  async clearanceAnalysis(start: number, end: number) {
    await ensureManifest();
    return call<ReturnType<typeof import('./queryEngine').queryClearanceAnalysis>>('clearanceAnalysis', { start, end });
  },

  async footfallStats(start?: number, end?: number): Promise<FootfallStats> {
    await ensureManifest();
    return call<FootfallStats>('footfallStats', { start, end });
  },

  async refreshDb(): Promise<void> {
    await call<null>('refreshDb');
  },
};
