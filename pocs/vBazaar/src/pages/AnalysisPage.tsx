import { useState, useEffect, ReactNode } from 'react';
import { api, FootfallHourlyPoint, BillingHourlyPoint, DwellData } from '../api';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';

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

// ── Section card shell ────────────────────────────────────────────────────────
function SectionCard({ title, color, children }: { title: string; color: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
        <div className="w-1 h-4 rounded-full" style={{ background: color }} />
        <h3 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ── Footfall table ────────────────────────────────────────────────────────────
function FootfallTable({ rows }: { rows: FootfallHourlyPoint[] }) {
  return (
    <div className="overflow-auto" style={{ maxHeight: 300 }}>
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-slate-50">
          <tr>
            <th className="text-left px-3 py-2 text-slate-400 font-black uppercase tracking-wider">Hour</th>
            <th className="text-right px-3 py-2 font-black uppercase tracking-wider" style={{ color: '#2E3192' }}>Male</th>
            <th className="text-right px-3 py-2 font-black uppercase tracking-wider" style={{ color: '#EC4899' }}>Female</th>
            <th className="text-right px-3 py-2 font-black uppercase tracking-wider" style={{ color: '#CA8A04' }}>Children</th>
            <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-slate-500">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50 transition-colors">
              <td className="px-3 py-2 text-slate-600 font-medium">{r.hour}</td>
              <td className="px-3 py-2 text-right font-medium text-slate-700 tabular-nums">{r.male.toLocaleString()}</td>
              <td className="px-3 py-2 text-right font-medium text-slate-700 tabular-nums">{r.female.toLocaleString()}</td>
              <td className="px-3 py-2 text-right font-medium text-slate-700 tabular-nums">{r.children.toLocaleString()}</td>
              <td className="px-3 py-2 text-right font-black text-slate-800 tabular-nums bg-slate-50">{r.total.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Billing table ─────────────────────────────────────────────────────────────
function BillingTable({ rows }: { rows: BillingHourlyPoint[] }) {
  return (
    <div className="overflow-auto" style={{ maxHeight: 300 }}>
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-slate-50">
          <tr>
            <th className="text-left px-3 py-2 text-slate-400 font-black uppercase tracking-wider">Hour</th>
            <th className="text-right px-3 py-2 font-black uppercase tracking-wider" style={{ color: '#F58220' }}>Avg Customers</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50 transition-colors">
              <td className="px-3 py-2 text-slate-600 font-medium">{r.hour}</td>
              <td className="px-3 py-2 text-right font-medium text-slate-700 tabular-nums">{r.avgCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function ViewToggle({ isTable, onToggle }: { isTable: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div className="flex rounded-lg border border-slate-200 overflow-hidden">
      <button onClick={() => onToggle(false)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all ${!isTable ? 'bg-[#2E3192] text-white' : 'text-slate-500 hover:text-[#2E3192] bg-white'}`}>
        <svg viewBox="0 0 16 16" fill="none" style={{ width: 13, height: 13 }}>
          <polyline points="14 8 11 8 9 14 6 2 4 8 2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Graph
      </button>
      <div className="w-px bg-slate-200" />
      <button onClick={() => onToggle(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all ${isTable ? 'bg-[#2E3192] text-white' : 'text-slate-500 hover:text-[#2E3192] bg-white'}`}>
        <svg viewBox="0 0 16 16" fill="none" style={{ width: 13, height: 13 }}>
          <rect x="1" y="1" width="14" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
          <line x1="1" y1="5.5" x2="15" y2="5.5" stroke="currentColor" strokeWidth="1.2" />
          <line x1="1" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="1.2" />
          <line x1="5.5" y1="5.5" x2="5.5" y2="15" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        Table
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AnalysisPage() {
  const [footfallHourly, setFootfallHourly] = useState<FootfallHourlyPoint[]>([]);
  const [billingHourly,  setBillingHourly]  = useState<BillingHourlyPoint[]>([]);
  const [dwellData,      setDwellData]      = useState<DwellData | null>(null);
  const [loading, setLoading] = useState(true);

  const [ffIsTable,   setFfIsTable]   = useState(false);
  const [billIsTable, setBillIsTable] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.footfallHourly(),
      api.billingHourly(),
      api.dwellSummary(),
    ]).then(([ff, bill, dwell]) => {
      setFootfallHourly(ff);
      setBillingHourly(bill);
      setDwellData(dwell);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading && footfallHourly.length === 0) {
    return <div className="text-center py-16 text-slate-400 text-sm">Loading data…</div>;
  }

  return (
    <div className="space-y-4">

      {/* ── Footfall Section ── */}
      <SectionCard title="Footfall — Hourly Breakdown" color="#2E3192">
        <div className="flex items-center justify-end px-5 py-2 border-b border-slate-100">
          <ViewToggle isTable={ffIsTable} onToggle={setFfIsTable} />
        </div>
        <div className="p-5">
          {ffIsTable ? (
            <FootfallTable rows={footfallHourly} />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={footfallHourly} margin={{ top: 10, right: 10, left: 10, bottom: 30 }}
                barCategoryGap="30%" barGap={1}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#64748b' }} angle={-20} textAnchor="end" height={45}
                  label={{ value: 'Hour', position: 'insideBottom', offset: -12, fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={50}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                  label={{ value: 'Count', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip content={<DarkTooltip />} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingBottom: 4 }} verticalAlign="top" />
                <Bar dataKey="male"     name="Male"     fill="#2E3192" radius={[2,2,0,0]} barSize={16} />
                <Bar dataKey="female"   name="Female"   fill="#EC4899" radius={[2,2,0,0]} barSize={16} />
                <Bar dataKey="children" name="Children" fill="#FACC15" radius={[2,2,0,0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </SectionCard>

      {/* ── Billing Section ── */}
      <SectionCard title="Billing — Customer Count Hourly" color="#2E3192">
        <div className="flex items-center justify-end px-5 py-2 border-b border-slate-100">
          <ViewToggle isTable={billIsTable} onToggle={setBillIsTable} />
        </div>
        <div className="p-5">
          {billIsTable ? (
            <BillingTable rows={billingHourly} />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={billingHourly} margin={{ top: 10, right: 20, left: 10, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#64748b' }}
                  label={{ value: 'Hour', position: 'insideBottom', offset: -12, fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={40}
                  label={{ value: 'Customers', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip content={<DarkTooltip />} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingBottom: 4 }} verticalAlign="top" />
                <Line type="monotone" dataKey="avgCount" name="Avg Customers" stroke="#F58220"
                  strokeWidth={2.5} dot={{ r: 3, fill: '#F58220', strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </SectionCard>

      {/* ── Dwell Time Section ── */}
      <SectionCard title="Dwell Time — Duration Distribution" color="#2E3192">
        <div className="p-5">
          {!dwellData || dwellData.total === 0 ? (
            <div className="flex items-center justify-center h-56">
              <p className="text-sm text-slate-400">No dwell data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={[
                  { label: '< 2 min',  value: dwellData.lessThan2,  color: '#F58220' },
                  { label: '2–10 min', value: dwellData.twoTo10,    color: '#2E3192' },
                  { label: '> 10 min', value: dwellData.moreThan10, color: '#00A651' },
                ]}
                margin={{ top: 10, right: 20, left: 10, bottom: 30 }} barCategoryGap="40%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }}
                  label={{ value: 'Duration', position: 'insideBottom', offset: -12, fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={50}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                  label={{ value: 'Visits', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="value" name="Visits" radius={[4,4,0,0]} maxBarSize={100}>
                  {[0,1,2].map(i => (
                    <Cell key={i} fill={['#F58220','#2E3192','#00A651'][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </SectionCard>

    </div>
  );
}
