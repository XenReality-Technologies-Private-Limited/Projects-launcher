// Module Web Worker — sql.js imported via ESM, WASM loaded from /sql-wasm.wasm (public asset)
/* eslint-disable @typescript-eslint/no-explicit-any */

import initSqlJs from 'sql.js';
import { loadVBazaarDb, invalidateAll } from './dbManager';
import {
  queryFootfallSummary, queryFootfallHourly,
  queryBillingSummary,  queryBillingHourly,
  calcDwell,
} from './queryEngine';

export type QueryType = 'footfallSummary' | 'footfallHourly' | 'billingSummary' | 'billingHourly' | 'dwellSummary' | 'invalidate';

export interface WorkerRequest {
  id:   string;
  type: QueryType;
}

export interface WorkerResponse {
  id:     string;
  ok:     boolean;
  data?:  unknown;
  error?: string;
}

let SQL: any = null;

async function initSql(): Promise<any> {
  if (SQL) return SQL;
  SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
  return SQL;
}

async function handleRequest(req: WorkerRequest): Promise<void> {
  const sql = await initSql();

  if (req.type === 'invalidate') {
    invalidateAll();
    (self as any).postMessage({ id: req.id, ok: true } as WorkerResponse);
    return;
  }

  try {
    const db = await loadVBazaarDb(sql);
    let data: unknown;

    switch (req.type) {
      case 'footfallSummary': data = queryFootfallSummary(db); break;
      case 'footfallHourly':  data = queryFootfallHourly(db);  break;
      case 'billingSummary':  data = queryBillingSummary(db);  break;
      case 'billingHourly':   data = queryBillingHourly(db);   break;
      case 'dwellSummary':    data = calcDwell(db);            break;
      default: throw new Error(`Unknown query type: ${req.type}`);
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
