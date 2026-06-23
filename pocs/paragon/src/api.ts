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

export interface DwellData {
  average: number;
  lessThan2: number;
  twoTo10: number;
  moreThan10: number;
}

export interface SummaryData {
  footfall: GenderBreakdown;
  dwellTime: DwellData;
}

export interface TrendPoint {
  date: string;
  footfall: number;
}

export interface HourlyPoint {
  hour: string;
  footfall: number;
  dwell?: number;
}

export interface SinglePoint { label: string; value: number }
export interface MultiPoint { label: string; male: number; female: number; children: number }

export interface PeriodsData {
  today: SummaryData;
  thisWeek: SummaryData;
  lastWeek: SummaryData;
  thisMonth: SummaryData;
  lastMonth: SummaryData;
}

export interface AnalysisDetailData {
  daily: DetailDailyPoint[];
  hourly: DetailHourlyPoint[];
}

export interface DetailDailyPoint {
  date: string;
  footfall: { male: number; female: number; children: number };
  dwell?: number;
}

export interface DetailHourlyPoint {
  hour: string;
  footfall: { male: number; female: number; children: number };
  dwell?: number;
}

export interface ClearanceState {
  isOccupied: boolean;
  isClean: boolean;
  uncleanDuration: number;
  uncleanSince?: number;
}

export type ClearanceTableState = ClearanceState & { tableLabel: string };

export interface ClearanceAlert {
  tableLabel: string;
  unixtime: number;
  uncleanDuration: number;
  tableId: string;  // 'clearance'
}

export interface FootfallStats {
  total:   number;
  groupIn: number;
  soloIn:  number;
}

export interface ClearanceDayPoint {
  date: string;
  events: number;
  avgDuration: number;
}

export interface ClearanceHourPoint {
  hour: string;
  events: number;
  avgDuration: number;
}

export interface ClearanceAnalysisData {
  daily: ClearanceDayPoint[];
  hourly: ClearanceHourPoint[];
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

  analysisDetail(start: number, end: number) {
    return dbApi.analysisDetail(start, end);
  },

  periods() {
    return dbApi.periods();
  },

  clearanceState(): Promise<ClearanceState | null> {
    return dbApi.clearanceState();
  },

  clearanceStates(): Promise<ClearanceTableState[]> {
    return dbApi.clearanceStates() as Promise<ClearanceTableState[]>;
  },

  clearanceAlerts(start?: number, end?: number): Promise<ClearanceAlert[]> {
    return dbApi.clearanceAlerts(start, end);
  },

  clearanceAnalysis(start: number, end: number): Promise<ClearanceAnalysisData> {
    return dbApi.clearanceAnalysis(start, end) as Promise<ClearanceAnalysisData>;
  },

  footfallStats(start?: number, end?: number): Promise<FootfallStats> {
    return dbApi.footfallStats(start, end);
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

// Format a count as exact number with comma separators
export function fmtCount(n: number): string {
  return n.toLocaleString();
}
