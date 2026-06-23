// Main-thread proxy: creates a singleton Web Worker and maps outgoing requests to Promises.

import type { WorkerRequest, WorkerResponse } from './dbWorker';
import type { GenderBreakdown, FootfallHourlyPoint, BillingSummaryData, BillingHourlyPoint, DwellData } from '../api';

let _worker: Worker | null = null;
const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();

function getWorker(): Worker {
  if (_worker) return _worker;
  _worker = new Worker(new URL('./dbWorker.ts', import.meta.url), { type: 'module' });
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

async function query<T>(type: WorkerRequest['type']): Promise<T> {
  const worker = getWorker();
  const id = Math.random().toString(36).slice(2);
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    worker.postMessage({ id, type } as WorkerRequest);
  });
}

export const dbApi = {
  footfallSummary() { return query<GenderBreakdown>('footfallSummary'); },
  footfallHourly()  { return query<FootfallHourlyPoint[]>('footfallHourly'); },
  billingSummary()  { return query<BillingSummaryData>('billingSummary'); },
  billingHourly()   { return query<BillingHourlyPoint[]>('billingHourly'); },
  dwellSummary()    { return query<DwellData>('dwellSummary'); },
};
