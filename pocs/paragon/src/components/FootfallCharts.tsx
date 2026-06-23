import type { FootfallStats } from '../api';
import {
  AreaChart, Area,
  BarChart, Bar, Cell, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
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

export default function FootfallCharts({
  stats,
  daily,
  hourly,
}: {
  stats: FootfallStats | null;
  daily: { date: string; footfall: number }[];
  hourly: { hour: string; footfall: number; dwell?: number }[];
}) {
  // Single-day: switch to hourly breakdown so chart is meaningful
  const isSingleDay = daily.length <= 1;
  const trendData = isSingleDay
    ? hourly.map(h => ({ date: h.hour, footfall: h.footfall }))
    : daily;
  const xLabel = isSingleDay ? 'Hour' : 'Date';

  const funnelData = stats ? [
    { name: 'Total',      value: stats.total,   pct: '100.0', color: '#2E3192' },
    { name: 'Group In',   value: stats.groupIn, pct: stats.total ? (stats.groupIn / stats.total * 100).toFixed(1) : '0.0', color: '#F58220' },
    { name: 'Individual', value: stats.soloIn,  pct: stats.total ? (stats.soloIn  / stats.total * 100).toFixed(1) : '0.0', color: '#10b981' },
  ] : [];

  return (
    <div className="space-y-4">

      {/* KPI stat cards */}
      {stats && (
        <div className="flex flex-wrap gap-3">
          {([
            { label: 'Total Visitors', value: stats.total,   color: '#2E3192' },
            { label: 'Group Entries',  value: stats.groupIn, color: '#F58220' },
            { label: 'Individual',     value: stats.soloIn,  color: '#10b981' },
          ]).map(c => (
            <div key={c.label} className="min-w-[10rem] rounded-xl shadow-sm p-3.5 cursor-default hover:shadow-md hover:-translate-y-0.5 transition-all"
              style={{ border: `1.5px solid ${c.color}`, background: `${c.color}18` }}>
              <p className="text-[9px] font-black uppercase tracking-[2px] text-slate-500 mb-1 leading-tight">{c.label}</p>
              <p className="text-xl font-black text-slate-800 leading-none">{c.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* KPI Trend Distribution + KPI Trend Total */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* KPI Trend Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full" style={{ background: '#2E3192' }} />
            <h2 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500">KPI Trend Distribution</h2>
          </div>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 30 }}>
                <defs>
                  <linearGradient id="kpiAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#2E3192" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#2E3192" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }}
                  label={{ value: xLabel, position: 'insideBottom', offset: -15, fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} width={36}
                  label={{ value: 'Footfall', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip content={<DarkTooltip />} />
                <Area type="monotone" dataKey="footfall" name="Footfall"
                  stroke="#2E3192" strokeWidth={2.5}
                  fill="url(#kpiAreaGradient)"
                  dot={{ r: 3, fill: '#2E3192', strokeWidth: 0 }}
                  activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-16 text-center text-sm text-slate-400">No data for this period</p>
          )}
        </div>

        {/* KPI Trend Total */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full" style={{ background: '#2E3192' }} />
            <h2 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500">KPI Trend Total</h2>
          </div>
          {funnelData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 130, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false}
                  label={{ value: 'Count', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#94a3b8' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={82} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={22}>
                  {funnelData.map(entry => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                  <LabelList dataKey="value" position="right"
                    content={(props: any) => {
                      const { x, y, width, height, value, index } = props;
                      const item = funnelData[index];
                      if (!item) return null;
                      return (
                        <text x={x + width + 6} y={y + height / 2}
                          fill="#374151" fontSize={11} fontWeight={700} dominantBaseline="middle">
                          {`${value} (${item.pct}%)`}
                        </text>
                      );
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-16 text-center text-sm text-slate-400">No data for this period</p>
          )}
        </div>

      </div>
    </div>
  );
}
