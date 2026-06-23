import { dbApi } from './db';

// ── Response types ────────────────────────────────────────────────────────────

export interface GenderBreakdown {
  total: number;
  male: number;
  female: number;
  children: number;
  malePercent: number;
  femalePercent: number;
  childPercent: number;
}

export interface FootfallHourlyPoint {
  hour: string;
  male: number;
  female: number;
  children: number;
  total: number;
  cumulative: number; // raw per-minute MAX sum — use this for trend charts
}

export interface BillingSummaryData {
  avgCustomers: number;
  peakCustomers: number;
  employeeUptimePct: number;
  totalEmployeeTime: number;    // seconds (cumulative)
  totalInteractionTime: number; // seconds (cumulative)
  queueLow: number;             // row count where customer_count < 2
  queueMedium: number;          // row count where customer_count 2–3
  queueHigh: number;            // row count where customer_count > 3
  totalRows: number;
}

export interface BillingHourlyPoint {
  hour: string;
  avgCount: number;
  maxCount: number;
  uptimePct: number;
}

export interface DwellData {
  average: number;    // minutes
  lessThan2: number;  // count of visits < 2 min
  twoTo10: number;    // count of visits 2–10 min
  moreThan10: number; // count of visits > 10 min
  total: number;
}

// ── Public API ────────────────────────────────────────────────────────────────

export const api = {
  footfallSummary() { return dbApi.footfallSummary(); },
  footfallHourly()  { return dbApi.footfallHourly();  },
  billingSummary()  { return dbApi.billingSummary();  },
  billingHourly()   { return dbApi.billingHourly();   },
  dwellSummary()    { return dbApi.dwellSummary();    },
};

// ── Formatting helpers ────────────────────────────────────────────────────────

export function fmtCount(n: number): string {
  return n.toLocaleString();
}

// Format seconds as HH:MM:SS
export function formatDuration(seconds: number): string {
  const total = Math.round(Math.abs(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
