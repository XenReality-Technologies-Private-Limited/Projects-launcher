import { dbApi } from './db/index';

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

export interface GreetingsData {
  total: number;
  greeted: number;
  unattended: number;
  greetingPercent: number;
  unattendedPercent: number;
}

export interface DwellData {
  average: number;    // minutes (float)
  lessThan2: number;  // count of visits < 2 min
  twoTo10: number;    // count of visits 2–10 min
  moreThan10: number; // count of visits > 10 min
}

export interface BillingData {
  averageBillingTime: number; // minutes (float)
  averageQueueSize:   number; // float
}

export interface SummaryData {
  passerby:  GenderBreakdown;
  footfall:  GenderBreakdown;
  greetings: GreetingsData;
  trials:    { total: number };
  dwellTime: DwellData;
  billing:   BillingData;
}

export interface TrendPoint {
  date: string;
  passerBy: number;
  footfall: number;
  trials: number;
  greeted: number;
  unattended: number;
  billing: number;
}

export interface HourlyPoint {
  hour: string;
  passerBy: number;
  footfall: number;
  trials: number;
  greetedPct: number;
  unattendedPct: number;
  billing: number;
  dwell?: number;
}

export interface MultiPoint { label: string; male: number; female: number; children: number }
export interface SinglePoint { label: string; value: number }

export interface PeriodsData {
  today:     SummaryData;
  thisWeek:  SummaryData;
  lastWeek:  SummaryData;
  thisMonth: SummaryData;
  lastMonth: SummaryData;
}

export interface AnalysisData {
  passerby:   { h12: MultiPoint[]; d7: MultiPoint[] };
  footfall:   { h12: MultiPoint[]; d7: MultiPoint[] };
  dwellTime:  { h12: SinglePoint[]; d7: SinglePoint[] };
  trials:     { h12: SinglePoint[]; d7: SinglePoint[] };
  greetings:  { h12: SinglePoint[]; d7: SinglePoint[] };
  unattended: { h12: SinglePoint[]; d7: SinglePoint[] };
  billing:    { h12: SinglePoint[]; d7: SinglePoint[] };
}

export interface DemoBucket { male: number; female: number; children: number }
export interface DetailDailyPoint {
  date: string;
  passerby: DemoBucket; footfall: DemoBucket;
  trials: number; greeted: number; unattended: number;
  billing: number;
  dwell?: number;
}
export interface DetailHourlyPoint {
  hour: string;
  passerby: DemoBucket; footfall: DemoBucket;
  trials: number; greeted: number; unattended: number;
  billing: number;
  dwell?: number;
}
export interface AnalysisDetailData {
  daily:  DetailDailyPoint[];
  hourly: DetailHourlyPoint[];
}

// ── Public API — delegates to client-side sql.js WASM worker ─────────────────

export const api = {
  summary(start?: number, end?: number) {
    return dbApi.summary(start, end);
  },

  trend(start?: number, end?: number) {
    return dbApi.trend(start, end);
  },

  hourly(start?: number, end?: number) {
    return dbApi.hourly(start, end);
  },

  analysis() {
    return dbApi.analysis();
  },

  analysisDetail(start: number, end: number) {
    return dbApi.analysisDetail(start, end);
  },

  periods() {
    return dbApi.periods();
  },
};

// Convert a YYYY-MM-DD date string to a Unix timestamp (local midnight)
export function dateToUnix(dateStr: string, endOfDay = false): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0);
  return Math.floor(dt.getTime() / 1000);
}

// Format average minutes as MM:SS
export function minsToMmSs(mins: number): string {
  const totalSecs = Math.round(mins * 60);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Format a count as exact number with comma separators: 11,457
export function fmtCount(n: number): string {
  return n.toLocaleString();
}
