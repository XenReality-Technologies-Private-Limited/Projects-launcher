import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { BillingSummaryData, BillingHourlyPoint, formatDuration } from '../api';

interface Props {
  data: BillingSummaryData | null;
  hourlyData: BillingHourlyPoint[];
  isPrinting?: boolean;
}

const QUEUE_COLORS = {
  Low:    '#00A651',
  Medium: '#F58220',
  High:   '#EF4444',
};

function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1e293b', borderRadius: 8, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: 130 }}>
      {label != null && <p style={{ color: 'white', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: i < payload.length - 1 ? 4 : 0 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: p.color ?? p.fill, flexShrink: 0 }} />
          <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{p.name}:</span>
          <span style={{ color: 'white', fontWeight: 600, fontSize: 12, marginLeft: 2 }}>{+(Number(p.value) || 0).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

function renderPieLabel(props: any) {
  const { cx, cy, midAngle, outerRadius, pct } = props;
  const RAD = Math.PI / 180;
  const x = cx + outerRadius * 0.65 * Math.cos(-midAngle * RAD);
  const y = cy + outerRadius * 0.65 * Math.sin(-midAngle * RAD);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700}>
      {pct}
    </text>
  );
}

export default function BillingSummary({ data, hourlyData, isPrinting }: Props) {
  const isLoading = data === null;

  const total = isLoading ? 1 : (data!.queueLow + data!.queueMedium + data!.queueHigh) || 1;
  const pieData = isLoading ? [] : [
    { name: 'Low (0–1 customers)',    value: data!.queueLow,    pct: `${(data!.queueLow    / total * 100).toFixed(1)}%`, color: QUEUE_COLORS.Low    },
    { name: 'Medium (2–3 customers)', value: data!.queueMedium, pct: `${(data!.queueMedium / total * 100).toFixed(1)}%`, color: QUEUE_COLORS.Medium },
    { name: 'High (4+ customers)',    value: data!.queueHigh,   pct: `${(data!.queueHigh   / total * 100).toFixed(1)}%`, color: QUEUE_COLORS.High   },
  ];


  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:break-inside-avoid">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
        <div className="w-1 h-4 rounded-full" style={{ background: '#2E3192' }} />
        <h2 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500">Billing KPI</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">

        {/* LEFT — Queue Distribution Pie */}
        <div className="p-5">
          <p className="text-[10px] font-black uppercase tracking-[2px] text-slate-400 mb-0.5">Queue Distribution</p>
          <p className="text-[10px] text-slate-400 mb-2">% of time billing counter had each queue level</p>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="h-2 bg-slate-100 rounded animate-pulse w-32" />
            </div>
          ) : (
            <ResponsiveContainer width={isPrinting ? 320 : '100%'} height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="45%"
                  outerRadius={100}
                  dataKey="value"
                  labelLine={false}
                  label={renderPieLabel}
                  isAnimationActive={!isPrinting}
                >
                  {pieData.map(entry => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* RIGHT — Metrics + Hourly trend */}
        <div className="p-5 flex flex-col gap-5">
          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Peak Customers */}
            <div className="rounded-xl p-3.5" style={{ border: '1.5px solid #F5822022', background: '#F5822008' }}>
              <p className="text-[9px] font-black uppercase tracking-[2px] text-slate-400 mb-1.5">Peak Customers</p>
              {isLoading
                ? <div className="h-7 bg-slate-100 rounded animate-pulse w-12" />
                : <p className="text-2xl font-black text-black">{data!.peakCustomers}</p>
              }
            </div>

            {/* Avg Queue Size */}
            <div className="rounded-xl p-3.5" style={{ border: '1.5px solid #2E319222', background: '#2E319208' }}>
              <p className="text-[9px] font-black uppercase tracking-[2px] text-slate-400 mb-1.5">Avg Queue Size</p>
              {isLoading
                ? <div className="h-7 bg-slate-100 rounded animate-pulse w-12" />
                : <p className="text-2xl font-black text-black">{data!.avgCustomers}</p>
              }
            </div>

            {/* Employee Uptime */}
            <div className="rounded-xl p-3.5" style={{ border: '1.5px solid #2E319222', background: '#2E319208' }}>
              <p className="text-[9px] font-black uppercase tracking-[2px] text-slate-400 mb-1.5">Employee Uptime</p>
              {isLoading
                ? <div className="h-7 bg-slate-100 rounded animate-pulse w-14" />
                : <p className="text-2xl font-black text-black">{data!.employeeUptimePct}%</p>
              }
            </div>

            {/* Employee Time */}
            <div className="rounded-xl p-3.5" style={{ border: '1.5px solid #2E319222', background: '#2E319208' }}>
              <p className="text-[9px] font-black uppercase tracking-[2px] text-slate-400 mb-1.5">Employee Time</p>
              {isLoading
                ? <div className="h-7 bg-slate-100 rounded animate-pulse w-20" />
                : <p className="text-xl font-black text-black tabular-nums">{formatDuration(data!.totalEmployeeTime)}</p>
              }
            </div>

            {/* Interaction Time */}
            <div className="col-span-2 rounded-xl p-3.5" style={{ border: '1.5px solid #2E319222', background: '#2E319208' }}>
              <p className="text-[9px] font-black uppercase tracking-[2px] text-slate-400 mb-1.5">Employee–Customer Interaction Time</p>
              {isLoading
                ? <div className="h-7 bg-slate-100 rounded animate-pulse w-20" />
                : <p className="text-xl font-black text-[#1e2a4a] tabular-nums">{formatDuration(data!.totalInteractionTime)}</p>
              }
            </div>

          </div>
        </div>

      </div>

      {/* ── Hourly billing trends ── */}
      {hourlyData.length > 0 && (
        <div className="border-t border-slate-100 p-5">
          <p className="text-[10px] font-black uppercase tracking-[2px] text-slate-400 mb-4">Hourly Trends</p>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={hourlyData} margin={{ top: 5, right: 50, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#64748b' }} width={36}
                label={{ value: 'Customers', angle: -90, position: 'insideLeft', offset: 10, fontSize: 9, fill: '#94a3b8' }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#64748b' }} width={40}
                domain={[0, 100]}
                label={{ value: 'Uptime %', angle: 90, position: 'insideRight', offset: 10, fontSize: 9, fill: '#94a3b8' }} />
              <Tooltip content={<DarkTooltip />} />
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} verticalAlign="top" />
              <Bar yAxisId="left" dataKey="avgCount" name="Avg Customers" fill="#2E3192" radius={[3,3,0,0]} barSize={24} isAnimationActive={!isPrinting} />
              <Line yAxisId="right" type="monotone" dataKey="uptimePct" name="Employee Uptime %"
                stroke="#F58220" strokeWidth={2.5} strokeDasharray="5 4"
                dot={{ r: 3, fill: '#F58220', strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={!isPrinting} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
