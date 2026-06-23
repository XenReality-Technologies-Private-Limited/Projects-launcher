import { useState, useCallback, useEffect, Fragment } from 'react';
import { api, dateToUnix, DetailDailyPoint, DetailHourlyPoint } from '../api';
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────
interface KpiSection {
  id:    string;
  name:  string;
  type:  'multi' | 'single';
  color: string;
  dailyKey:  keyof DetailDailyPoint;
  hourlyKey: keyof DetailHourlyPoint;
}

const SECTIONS: KpiSection[] = [
  { id: 'passerby',   name: 'Passer By',  type: 'multi',  color: '#2E3192', dailyKey: 'passerby',   hourlyKey: 'passerby'   },
  { id: 'footfall',   name: 'Footfall',   type: 'multi',  color: '#00AEEF', dailyKey: 'footfall',   hourlyKey: 'footfall'   },
  { id: 'greeted',    name: 'Greeted',    type: 'single', color: '#00A651', dailyKey: 'greeted',    hourlyKey: 'greeted'    },
  { id: 'unattended', name: 'Unattended', type: 'single', color: '#EF4444', dailyKey: 'unattended', hourlyKey: 'unattended' },
  { id: 'dwell',      name: 'Dwell Time', type: 'single', color: '#FACC15', dailyKey: 'dwell',      hourlyKey: 'dwell'      },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtV(v: number) {
  return v >= 1000000 ? `${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v);
}

// ── Dark tooltip ──────────────────────────────────────────────────────────────
function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1e293b', borderRadius: 8, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: 148 }}>
      {label != null && <p style={{ color: 'white', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{label}</p>}
      {payload.map((p: any, i: number) => {
        const v = p.value ?? 0;
        const display = v >= 1000000 ? `${(v / 1e6).toFixed(2)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: i < payload.length - 1 ? 4 : 0 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: p.color ?? p.stroke, flexShrink: 0 }} />
            <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{p.name}:</span>
            <span style={{ color: 'white', fontWeight: 600, fontSize: 12, marginLeft: 2 }}>{display}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Toggle icons ──────────────────────────────────────────────────────────────
function ChartIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" style={{ width: 13, height: 13 }}>
      <polyline points="14 8 11 8 9 14 6 2 4 8 2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function TableIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" style={{ width: 13, height: 13 }}>
      <rect x="1" y="1" width="14" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <line x1="1" y1="5.5" x2="15" y2="5.5" stroke="currentColor" strokeWidth="1.2" />
      <line x1="1" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="1.2" />
      <line x1="5.5" y1="5.5" x2="5.5" y2="15" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

// ── Charts ────────────────────────────────────────────────────────────────────
function MultiLineChart({ data, xKey, xLabel = 'Time', yLabel = 'Count' }: { data: any[]; xKey: string; xLabel?: string; yLabel?: string }) {
  const chartData = data.length === 1
    ? [data[0], { ...data[0], [xKey]: (data[0][xKey] ?? '') + '​' }]
    : data;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd" label={{ value: xLabel, position: 'insideBottom', offset: -12, fontSize: 10, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={fmtV} width={48} label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#94a3b8' }} />
        <Tooltip content={<DarkTooltip />} />
        <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingBottom: 4 }} verticalAlign="top" />
        <Line type="monotone" dataKey="male"     name="Male"     stroke="#2E3192" strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="female"   name="Female"   stroke="#EC4899" strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="children" name="Children" stroke="#FACC15" strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function SingleLineChart({ data, xKey, color, name, xLabel = 'Time', yLabel = 'Count' }: { data: any[]; xKey: string; color: string; name: string; xLabel?: string; yLabel?: string }) {
  const chartData = data.length === 1
    ? [data[0], { ...data[0], [xKey]: (data[0][xKey] ?? '') + '​' }]
    : data;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd" label={{ value: xLabel, position: 'insideBottom', offset: -12, fontSize: 10, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={fmtV} width={48} label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#94a3b8' }} />
        <Tooltip content={<DarkTooltip />} />
        <Line type="monotone" dataKey="value" name={name} stroke={color} strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function DataTable({ rows, isMulti, color, name }: { rows: any[]; isMulti: boolean; color: string; name: string }) {
  return (
    <div className="overflow-auto" style={{ height: 220 }}>
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-slate-50">
          <tr>
            <th className="text-left px-3 py-2 text-slate-400 font-black uppercase tracking-wider">Time</th>
            {isMulti ? (
              <>
                <th className="text-right px-3 py-2 font-black uppercase tracking-wider" style={{ color: '#2E3192' }}>Male</th>
                <th className="text-right px-3 py-2 font-black uppercase tracking-wider" style={{ color: '#EC4899' }}>Female</th>
                <th className="text-right px-3 py-2 font-black uppercase tracking-wider" style={{ color: '#CA8A04' }}>Children</th>
                <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-slate-500">Total</th>
              </>
            ) : (
              <th className="text-right px-3 py-2 font-black uppercase tracking-wider" style={{ color }}>{name}</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => {
            const rowTotal = isMulti ? (row.male ?? 0) + (row.female ?? 0) + (row.children ?? 0) : null;
            return (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2 text-slate-600">{row.label}</td>
                {isMulti ? (
                  <>
                    <td className="px-3 py-2 text-right font-medium text-slate-700 tabular-nums">{(row.male ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-700 tabular-nums">{(row.female ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-700 tabular-nums">{(row.children ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-black text-slate-800 tabular-nums bg-slate-50">{rowTotal!.toLocaleString()}</td>
                  </>
                ) : (
                  <td className="px-3 py-2 text-right font-medium text-slate-700 tabular-nums">{(row.value ?? 0).toLocaleString()}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ section, dailyRows, hourlyRows }: {
  section: KpiSection;
  dailyRows: any[];
  hourlyRows: any[];
}) {
  const [isTable, setIsTable] = useState(false);
  const isMulti = section.type === 'multi';

  function renderPanel(rows: any[], isHourly: boolean) {
    const xLabel = isHourly ? 'Time' : 'Date';
    const yLabel = section.name;
    if (isTable) return <DataTable rows={rows} isMulti={isMulti} color={section.color} name={section.name} />;
    if (isMulti)  return <MultiLineChart data={rows} xKey="label" xLabel={xLabel} yLabel="Count" />;
    return <SingleLineChart data={rows} xKey="label" color={section.color} name={section.name} xLabel={xLabel} yLabel={yLabel} />;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full" style={{ background: section.color }} />
          <h3 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500">{section.name}</h3>
        </div>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button onClick={() => setIsTable(false)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all ${!isTable ? 'bg-[#2E3192] text-white' : 'text-slate-500 hover:text-[#2E3192] bg-white'}`}>
            <ChartIcon /> Graph
          </button>
          <div className="w-px bg-slate-200" />
          <button onClick={() => setIsTable(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all ${isTable ? 'bg-[#2E3192] text-white' : 'text-slate-500 hover:text-[#2E3192] bg-white'}`}>
            <TableIcon /> Table
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
        <div className="p-4">
          <p className="text-[10px] font-black uppercase tracking-[2px] text-slate-400 mb-2">Daily Breakdown</p>
          {renderPanel(dailyRows, false)}
        </div>
        <div className="p-4">
          <p className="text-[10px] font-black uppercase tracking-[2px] text-slate-400 mb-2">Hourly Average</p>
          {renderPanel(hourlyRows, true)}
        </div>
      </div>
    </div>
  );
}

// ── Export Modal ──────────────────────────────────────────────────────────────
function ExportModal({ fromDate, toDate, dailyData, hourlyData, onClose }: {
  fromDate: string; toDate: string;
  dailyData: DetailDailyPoint[]; hourlyData: DetailHourlyPoint[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(SECTIONS.map(s => s.id)));
  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function exportCSV() {
    const rows: string[] = [];
    for (const sec of SECTIONS) {
      if (!selected.has(sec.id)) continue;
      const isMulti = sec.type === 'multi';
      rows.push(`\n${sec.name.toUpperCase()} — Daily Breakdown`);
      rows.push(isMulti ? 'Date,Male,Female,Children,Total' : 'Date,Count');
      for (const d of dailyData) {
        if (isMulti) {
          const v = d[sec.dailyKey] as any;
          const total = (v.male || 0) + (v.female || 0) + (v.children || 0);
          rows.push(`${d.date},${v.male},${v.female},${v.children},${total}`);
        } else {
          rows.push(`${d.date},${d[sec.dailyKey]}`);
        }
      }
      rows.push(`\n${sec.name.toUpperCase()} — Hourly Average`);
      rows.push(isMulti ? 'Hour,Male,Female,Children,Total' : 'Hour,Count');
      for (const h of hourlyData) {
        if (isMulti) {
          const v = h[sec.hourlyKey] as any;
          const total = (v.male || 0) + (v.female || 0) + (v.children || 0);
          rows.push(`${h.hour},${v.male},${v.female},${v.children},${total}`);
        } else {
          rows.push(`${h.hour},${h[sec.hourlyKey]}`);
        }
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `kpi-report_${fromDate}_to_${toDate}.csv`; a.click();
    URL.revokeObjectURL(url);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-black text-slate-800">Export KPI Report</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[2px] text-slate-400 mb-3">Time Range</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-slate-500 mb-1 block">From Date</label>
                <div className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-slate-50">{fromDate}</div></div>
              <div><label className="text-xs text-slate-500 mb-1 block">To Date</label>
                <div className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-slate-50">{toDate}</div></div>
            </div>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[2px] text-slate-400 mb-3">Store Code</p>
            <div className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-slate-50">0001 — Sultan, Bangalore, Karnataka</div>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[2px] text-slate-400 mb-3">Select KPIs</p>
            <div className="space-y-2">
              {SECTIONS.map(s => (
                <label key={s.id} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)}
                    className="w-4 h-4 rounded accent-[#2E3192] cursor-pointer" />
                  <span className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={exportCSV} disabled={selected.size === 0}
            className="px-5 py-2 rounded-lg bg-[#2E3192] text-white text-sm font-bold hover:bg-[#252880] transition-colors disabled:opacity-40 flex items-center gap-2">
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
  fromDate: string;
  toDate: string;
  exportOpen: boolean;
  onExportClose: () => void;
}) {
  const [daily,   setDaily]   = useState<DetailDailyPoint[]>([]);
  const [hourly,  setHourly]  = useState<DetailHourlyPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (from: string, to: string) => {
    setLoading(true);
    try {
      const start = dateToUnix(from);
      const end   = dateToUnix(to, true);
      const data  = await api.analysisDetail(start, end);
      setDaily(data.daily);
      setHourly(data.hourly);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(fromDate, toDate); }, [fromDate, toDate, fetchData]);

  function buildRows(sec: KpiSection) {
    const isMulti = sec.type === 'multi';

    const dailyRows = daily.map(d => {
      if (isMulti) {
        const v = d[sec.dailyKey] as any;
        return { label: d.date, male: v.male, female: v.female, children: v.children };
      }
      return { label: d.date, value: (d[sec.dailyKey] as number) ?? 0 };
    });

    const hourlyRows = hourly.map(h => {
      if (isMulti) {
        const v = h[sec.hourlyKey] as any;
        return { label: `${h.hour}:00`, male: v.male, female: v.female, children: v.children };
      }
      return { label: `${h.hour}:00`, value: (h[sec.hourlyKey] as number) ?? 0 };
    });

    return { dailyRows, hourlyRows };
  }

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      {loading && daily.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">Loading data…</div>
      ) : (
        SECTIONS.map(sec => {
          const { dailyRows, hourlyRows } = buildRows(sec);
          return (
            <Fragment key={sec.id}>
              <KpiCard section={sec} dailyRows={dailyRows} hourlyRows={hourlyRows} />
            </Fragment>
          );
        })
      )}

      {exportOpen && (
        <ExportModal
          fromDate={fromDate} toDate={toDate}
          dailyData={daily} hourlyData={hourly}
          onClose={onExportClose}
        />
      )}
    </div>
  );
}
