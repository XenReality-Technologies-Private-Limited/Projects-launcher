import { useState, useCallback, useEffect } from 'react';
import { api, dateToUnix, FootfallStats } from '../api';
import { dbApi } from '../db/index';
import {
  BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1e293b', borderRadius: 8, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: 148 }}>
      {label != null && <p style={{ color: 'white', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: i < payload.length - 1 ? 4 : 0 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: p.color ?? p.stroke, flexShrink: 0 }} />
          <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{p.name}:</span>
          <span style={{ color: 'white', fontWeight: 600, fontSize: 12, marginLeft: 2 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

const ACCENT    = '#2E3192';
const ORANGE    = '#F58220';
const GREEN     = '#10b981';
const BAR_COLORS = [ACCENT, ORANGE, GREEN];

// ── View toggle ───────────────────────────────────────────────────────────────
function ViewToggle({ view, onChange }: { view: 'graph' | 'table'; onChange: (v: 'graph' | 'table') => void }) {
  const btn = (v: 'graph' | 'table', label: string, icon: React.ReactNode) => (
    <button onClick={() => onChange(v)}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${
        view === v
          ? 'bg-[#2E3192] text-white'
          : 'bg-white text-slate-500 hover:bg-slate-50'
      } ${v === 'graph' ? 'rounded-l-lg border border-slate-200' : 'rounded-r-lg border-t border-b border-r border-slate-200'}`}>
      {icon}
      {label}
    </button>
  );
  return (
    <div className="flex">
      {btn('graph', 'Graph',
        <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
          <path d="M2 12l4-4 3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {btn('table', 'Table',
        <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
          <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.3" />
          <path d="M2 6h12M6 6v8" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      )}
    </div>
  );
}

// ── Charts ────────────────────────────────────────────────────────────────────
function DailyFootfallChart({ data }: { data: { date: string; footfall: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 24 }} barCategoryGap="35%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd"
          label={{ value: 'Date', position: 'insideBottom', offset: -12, fontSize: 10, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} width={36}
          label={{ value: 'Visitors', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#94a3b8' }} />
        <Tooltip content={<DarkTooltip />} />
        <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingBottom: 4 }} verticalAlign="top" />
        <Bar dataKey="footfall" name="Daily Footfall" fill={ACCENT} radius={[3, 3, 0, 0]} maxBarSize={80} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function HourlyFootfallChart({ data }: { data: { hour: string; footfall: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 24 }} barCategoryGap="35%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd"
          label={{ value: 'Hour of Day', position: 'insideBottom', offset: -12, fontSize: 10, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} width={36}
          label={{ value: 'Visitors', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#94a3b8' }} />
        <Tooltip content={<DarkTooltip />} />
        <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingBottom: 4 }} verticalAlign="top" />
        <Bar dataKey="footfall" name="Hourly Footfall" fill={ACCENT} radius={[3, 3, 0, 0]} maxBarSize={50} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function GroupSoloChart({ stats }: { stats: FootfallStats }) {
  const data = [
    { label: 'Total',      value: stats.total   },
    { label: 'Group',      value: stats.groupIn  },
    { label: 'Individual', value: stats.soloIn   },
  ];
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 24 }} barCategoryGap="40%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} width={36}
          label={{ value: 'Visitors', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#94a3b8' }} />
        <Tooltip content={<DarkTooltip />} />
        <Bar dataKey="value" name="Visitors" radius={[3, 3, 0, 0]} maxBarSize={80}>
          {data.map((_, i) => <Cell key={i} fill={BAR_COLORS[i]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Tables ────────────────────────────────────────────────────────────────────
const TH = 'px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-[2px]';
const TD = 'px-4 py-2.5 text-sm tabular-nums';

function DailyTable({ data }: { data: { date: string; footfall: number }[] }) {
  return (
    <div className="overflow-auto max-h-64">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
          <tr>
            <th className={`${TH} text-slate-500`}>Date</th>
            <th className={`${TH}`} style={{ color: ACCENT }}>Footfall</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {data.length === 0
            ? <tr><td colSpan={2} className="px-4 py-6 text-center text-slate-400 text-xs">No data</td></tr>
            : data.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className={`${TD} text-slate-600`}>{r.date}</td>
                <td className={`${TD} font-semibold`} style={{ color: ACCENT }}>{r.footfall}</td>
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}

function HourlyTable({ data }: { data: { hour: string; footfall: number }[] }) {
  return (
    <div className="overflow-auto max-h-64">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
          <tr>
            <th className={`${TH} text-slate-500`}>Hour</th>
            <th className={`${TH}`} style={{ color: ACCENT }}>Footfall</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {data.length === 0
            ? <tr><td colSpan={2} className="px-4 py-6 text-center text-slate-400 text-xs">No data</td></tr>
            : data.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className={`${TD} text-slate-600`}>{r.hour}</td>
                <td className={`${TD} font-semibold`} style={{ color: ACCENT }}>{r.footfall}</td>
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}

function GroupSoloTable({ stats }: { stats: FootfallStats }) {
  const rows = [
    { label: 'Total',      value: stats.total,   color: ACCENT },
    { label: 'Group In',   value: stats.groupIn, color: ORANGE },
    { label: 'Individual', value: stats.soloIn,  color: GREEN  },
  ];
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
          <tr>
            <th className={`${TH} text-slate-500`}>Category</th>
            <th className={`${TH} text-slate-500`}>Count</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map(r => (
            <tr key={r.label} className="hover:bg-slate-50">
              <td className={`${TD} font-semibold`} style={{ color: r.color }}>{r.label}</td>
              <td className={`${TD} font-black text-slate-800`}>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────
function doExportCsv(
  fromDate: string, toDate: string,
  daily: { date: string; footfall: number }[],
  hourly: { hour: string; footfall: number }[],
  stats: FootfallStats | null,
) {
  const lines: string[] = [
    `Footfall Report,${fromDate} to ${toDate}`,
    '',
    'DAILY BREAKDOWN',
    'Date,Footfall',
    ...daily.map(r => `${r.date},${r.footfall}`),
    '',
    'HOURLY BREAKDOWN',
    'Hour,Footfall',
    ...hourly.map(r => `${r.hour},${r.footfall}`),
  ];
  if (stats) {
    lines.push('', 'FOOTFALL BREAKDOWN', 'Category,Count',
      `Total,${stats.total}`, `Group In,${stats.groupIn}`, `Individual,${stats.soloIn}`);
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `footfall_${fromDate}_${toDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportModal({ fromDate, toDate, onClose, daily, hourly, stats }: {
  fromDate: string; toDate: string; onClose: () => void;
  daily: { date: string; footfall: number }[];
  hourly: { hour: string; footfall: number }[];
  stats: FootfallStats | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-black text-slate-800">Export Report</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-500 mb-1 block">From</label>
              <div className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-slate-50">{fromDate}</div></div>
            <div><label className="text-xs text-slate-500 mb-1 block">To</label>
              <div className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-slate-50">{toDate}</div></div>
          </div>
          <p className="text-xs text-slate-500">Downloads a CSV with daily breakdown, hourly breakdown, and footfall totals for the selected period.</p>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
          <button
            onClick={() => { doExportCsv(fromDate, toDate, daily, hourly, stats); onClose(); }}
            className="px-5 py-2 rounded-lg bg-[#2E3192] text-white text-sm font-bold hover:bg-[#252880] transition-colors flex items-center gap-2">
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
              <path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AnalysisPage({ fromDate, toDate, exportOpen, onExportClose }: {
  fromDate: string; toDate: string;
  exportOpen: boolean; onExportClose: () => void;
}) {
  const [dailyFootfall,  setDailyFootfall]  = useState<{ date: string; footfall: number }[]>([]);
  const [hourlyFootfall, setHourlyFootfall] = useState<{ hour: string; footfall: number }[]>([]);
  const [footfallStats,  setFootfallStats]  = useState<FootfallStats | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [view1, setView1] = useState<'graph' | 'table'>('graph');
  const [view2, setView2] = useState<'graph' | 'table'>('graph');

  const fetchData = useCallback(async (from: string, to: string) => {
    setLoading(true);
    try {
      const start = dateToUnix(from);
      const end   = dateToUnix(to, true);
      const [trend, hourlyData, stats] = await Promise.all([
        dbApi.trend(start, end),
        dbApi.hourly(start, end),
        api.footfallStats(start, end),
      ]);
      setDailyFootfall((trend as any[]).map(p => ({ date: p.date, footfall: p.footfall })));
      setHourlyFootfall((hourlyData as any[]).map(p => ({ hour: p.hour, footfall: p.footfall })));
      setFootfallStats(stats);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(fromDate, toDate); }, [fromDate, toDate, fetchData]);

  if (loading && dailyFootfall.length === 0) {
    return <div className="text-center py-16 text-slate-400 text-sm">Loading data…</div>;
  }

  return (
    <div className="space-y-4">

      {/* Footfall — Daily & Hourly */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center">
            <div className="w-1 h-4 rounded-full mr-2" style={{ background: ACCENT }} />
            <h3 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500">Footfall</h3>
          </div>
          <ViewToggle view={view1} onChange={setView1} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          <div className="p-4">
            <p className="text-[10px] font-black uppercase tracking-[2px] text-slate-400 mb-2">Daily Breakdown</p>
            {view1 === 'graph'
              ? (dailyFootfall.length > 0 ? <DailyFootfallChart data={dailyFootfall} /> : <p className="py-12 text-center text-sm text-slate-400">No data</p>)
              : <DailyTable data={dailyFootfall} />
            }
          </div>
          <div className="p-4">
            <p className="text-[10px] font-black uppercase tracking-[2px] text-slate-400 mb-2">Hourly Average</p>
            {view1 === 'graph'
              ? (hourlyFootfall.length > 0 ? <HourlyFootfallChart data={hourlyFootfall} /> : <p className="py-12 text-center text-sm text-slate-400">No data</p>)
              : <HourlyTable data={hourlyFootfall} />
            }
          </div>
        </div>
      </div>

      {/* Group vs Individual */}
      {footfallStats && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <div className="flex items-center">
              <div className="w-1 h-4 rounded-full mr-2" style={{ background: ACCENT }} />
              <h3 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500">Footfall — Group vs Individual</h3>
            </div>
            <ViewToggle view={view2} onChange={setView2} />
          </div>
          <div className="p-4">
            {view2 === 'graph'
              ? <GroupSoloChart stats={footfallStats} />
              : <GroupSoloTable stats={footfallStats} />
            }
          </div>
        </div>
      )}

      {exportOpen && (
        <ExportModal
          fromDate={fromDate} toDate={toDate} onClose={onExportClose}
          daily={dailyFootfall} hourly={hourlyFootfall} stats={footfallStats}
        />
      )}
    </div>
  );
}
