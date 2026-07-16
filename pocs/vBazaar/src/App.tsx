import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AnalysisPage from './pages/AnalysisPage';
import BillingSummary from './components/BillingSummary';
import {
  BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList,
  PieChart, Pie, YAxisProps,
} from 'recharts';
import {
  api, fmtCount, formatDuration,
  GenderBreakdown, BillingSummaryData, BillingHourlyPoint, FootfallHourlyPoint, DwellData,
} from './api';

const XENREALITY_LOGO = '/xenlogo.png';
const VBAZAAR_LOGO    = 'https://d2uimaqek2eby3.cloudfront.net/V%20Bazaar/V-Bazaar-logo.png';

type Tab = 'dashboard' | 'analysis';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'analysis',  label: 'Analysis'  },
];

function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1e293b', borderRadius: 8, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: 148 }}>
      {label != null && label !== '' && (
        <p style={{ color: 'white', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{label}</p>
      )}
      {payload.map((p: any, i: number) => {
        const v = p.value;
        const key: string = p.dataKey ?? '';
        const isPct = key.toLowerCase().endsWith('pct') || key.toLowerCase().includes('percent');
        const baseVal = isPct
          ? `${Number(v).toFixed(1)}%`
          : v >= 1000000 ? `${(v / 1000000).toFixed(2)}M`
          : v >= 1000  ? `${(v / 1000).toFixed(1)}K`
          : String(v ?? 0);
        const name = p.payload?.gender ?? p.name;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: i < payload.length - 1 ? 4 : 0 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: p.color ?? p.fill, flexShrink: 0 }} />
            <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{name}:</span>
            <span style={{ color: 'white', fontWeight: 600, fontSize: 12, marginLeft: 2 }}>{baseVal}</span>
          </div>
        );
      })}
    </div>
  );
}

// Static fallback footfall demographics data (shown while loading)
const DEMO_FALLBACK = [
  { gender: 'Male',   value: 0, pct: 0, color: '#2E3192' },
  { gender: 'Female', value: 0, pct: 0, color: '#EC4899' },
  { gender: 'Child',  value: 0, pct: 0, color: '#FACC15' },
];

export default function App() {
  const isEmbedded = typeof window !== 'undefined' && window.self !== window.top;
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const isMobile = windowWidth < 640;

  // Print helpers
  const [isPrinting, setIsPrinting] = useState(false);
  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setIsPrinting(false), 500);
    }, 2000);
  };
  useEffect(() => {
    const before = () => setIsPrinting(true);
    const after  = () => setIsPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint',  after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint',  after);
    };
  }, []);

  // ── Data state ────────────────────────────────────────────────────────────────
  const [footfallSummary, setFootfallSummary] = useState<GenderBreakdown | null>(null);
  const [billingSummary,  setBillingSummary]  = useState<BillingSummaryData | null>(null);
  const [footfallHourly,  setFootfallHourly]  = useState<FootfallHourlyPoint[]>([]);
  const [billingHourly,   setBillingHourly]   = useState<BillingHourlyPoint[]>([]);
  const [dwellData,       setDwellData]       = useState<DwellData | null>(null);

  useEffect(() => {
    api.footfallSummary().then(setFootfallSummary).catch(console.error);
    api.billingSummary().then(setBillingSummary).catch(console.error);
    api.footfallHourly().then(setFootfallHourly).catch(console.error);
    api.billingHourly().then(setBillingHourly).catch(console.error);
    api.dwellSummary().then(setDwellData).catch(console.error);
  }, []);

  // ── Derived chart data ────────────────────────────────────────────────────────
  const demographicsData = footfallSummary ? [
    { gender: 'Male',   value: footfallSummary.male,     pct: footfallSummary.malePercent,   color: '#2E3192' },
    { gender: 'Female', value: footfallSummary.female,   pct: footfallSummary.femalePercent, color: '#EC4899' },
    { gender: 'Child',  value: footfallSummary.children, pct: footfallSummary.childPercent,  color: '#FACC15' },
  ] : DEMO_FALLBACK;

  // Merge footfall + billing hourly by hour label for Trends chart
  const trendsData = footfallHourly.map(ff => {
    const bill = billingHourly.find(b => b.hour === ff.hour);
    return { hour: ff.hour, footfall: ff.total, avgCustomers: bill?.avgCount ?? 0, uptimePct: bill?.uptimePct ?? 0 };
  });

  const dwellTotal = dwellData ? (dwellData.lessThan2 + dwellData.twoTo10 + dwellData.moreThan10) || 1 : 1;
  const dwellPieData = dwellData ? [
    { name: '< 2 min',   value: dwellData.lessThan2,  color: '#F58220' },
    { name: '2–10 min',  value: dwellData.twoTo10,    color: '#2E3192' },
    { name: '> 10 min',  value: dwellData.moreThan10, color: '#00A651' },
  ] : [];
  function renderDwellLabel({ cx, cy, midAngle, outerRadius, index }: any) {
    const RAD = Math.PI / 180;
    const x = cx + outerRadius * 0.65 * Math.cos(-midAngle * RAD);
    const y = cy + outerRadius * 0.65 * Math.sin(-midAngle * RAD);
    const pctVal = Math.round((dwellPieData[index]?.value ?? 0) / dwellTotal * 100);
    if (pctVal < 3) return null;
    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}>{pctVal}%</text>;
  }

  function handleSignOut() {
    logout();
    navigate('/login', { replace: true });
  }

  const userInitial = (user?.role || user?.name || user?.username || 'A')[0].toUpperCase();
  const userDisplay = user?.role || user?.name || user?.username || 'admin';

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-[#f5f6fa] font-sans">
        <style>{`
          @media print {
            .xr-logo-block { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
            .recharts-wrapper, .recharts-surface { max-width: 100% !important; overflow: hidden !important; }
          }
        `}</style>

        {/* Print-only header */}
        <div className="hidden print:flex items-stretch border-b border-slate-200" style={{ height: 56 }}>
          <div className="flex items-center px-5 shrink-0 xr-logo-block" style={{ background: '#2E3192' }}>
            <img src={XENREALITY_LOGO} alt="XenReality" className="h-7 w-auto object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <span className="font-bold text-sm text-slate-700">V-Bazaar Dashboard</span>
          </div>
          <div className="flex items-center px-4 shrink-0">
            <img src={VBAZAAR_LOGO} alt="V-Bazaar" style={{ height: 28, maxWidth: 110, objectFit: 'contain' }} />
          </div>
        </div>

        {/* ── STICKY TOP BAR ── */}
        <div className="sticky top-0 z-50 shadow-[0_2px_8px_rgba(0,0,0,0.08)] print:hidden">

          {/* LINE 1: HEADER — hidden when embedded in the PoC wrapper iframe */}
          {!isEmbedded && <header className="bg-white border-b border-slate-200">
            <div className="relative flex items-stretch h-12 sm:h-14">
              {/* Blue XenReality block */}
              <div className="flex items-center px-5 shrink-0 xr-logo-block" style={{ background: '#2E3192' }}>
                <img src={XENREALITY_LOGO} alt="XenReality" className="h-7 w-auto object-contain"
                  style={{ filter: 'brightness(0) invert(1)' }} />
              </div>

              {/* Title — absolutely centred */}
              <span className="hidden sm:block print:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-bold text-sm tracking-wide text-slate-700 whitespace-nowrap pointer-events-none">
                V-Bazaar Dashboard
              </span>

              {/* Right items */}
              <div className="flex items-center justify-end flex-1 px-2 sm:px-5">
                <img src={VBAZAAR_LOGO} alt="V-Bazaar" className="h-11 w-auto object-contain" />
              </div>
            </div>

          </header>}

          {/* LINE 2: TABS */}
          <div className="bg-white border-b border-slate-200">
            <div className="px-3 sm:px-6 flex overflow-x-auto items-center justify-between">
              <div className="flex overflow-x-auto">
                {TABS.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`px-4 sm:px-6 py-3 sm:py-3.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-[#2E3192] text-[#2E3192]'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>{/* end sticky */}

        {/* ── PAGE CONTENT ── */}
        <div className="px-3 sm:px-6 py-4 sm:py-5 max-w-screen-2xl mx-auto">

          {activeTab === 'analysis' ? (
            <AnalysisPage />
          ) : (
            <>
              {/* ── KPI CARDS (Footfall + Avg Dwell) ── */}
              <div className="mb-6 print:mb-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full" style={{ background: '#2E3192' }} />
                  <h2 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500">Key Performance Indicators</h2>
                </div>
                <div className="flex flex-wrap gap-3">
                  {footfallSummary === null ? (
                    ['#00AEEF','#F58220'].map((c, i) => (
                      <div key={i} className="w-48 rounded-xl shadow-sm p-4 space-y-2"
                        style={{ border: `1.5px solid ${c}`, background: `${c}18` }}>
                        <div className="h-2 bg-white/60 rounded animate-pulse w-14" />
                        <div className="h-7 bg-white/60 rounded animate-pulse w-20" />
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="w-48 rounded-xl shadow-sm p-4"
                        style={{ border: '1.5px solid #00AEEF', background: '#00AEEF18' }}>
                        <p className="text-[9px] font-black uppercase tracking-[2px] text-slate-500 mb-2 leading-tight">Footfall</p>
                        <p className="text-2xl font-black text-slate-800 leading-none print:text-base">{fmtCount(footfallSummary.total)}</p>
                      </div>
                      <div className="w-48 rounded-xl shadow-sm p-4"
                        style={{ border: '1.5px solid #F58220', background: '#F5822018' }}>
                        <p className="text-[9px] font-black uppercase tracking-[2px] text-slate-500 mb-2 leading-tight">Avg Dwell Time</p>
                        {dwellData
                          ? <p className="text-2xl font-black text-slate-800 leading-none print:text-base">{dwellData.average} <span className="text-sm font-bold text-slate-500">min</span></p>
                          : <div className="h-7 bg-white/60 rounded animate-pulse w-16" />
                        }
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ── TRENDS + FOOTFALL DEMOGRAPHICS (2-column row) ── */}
              <div className="mb-6 print:mb-3 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

                {/* Trends Through the Day */}
                {trendsData.length > 0 && (
                  <div className="print:break-inside-avoid bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
                      <div className="w-1 h-4 rounded-full" style={{ background: '#2E3192' }} />
                      <h2 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500">Trends Through the Day</h2>
                    </div>
                    <div className="p-5">
                      <ResponsiveContainer width="100%" height={260}>
                        <ComposedChart data={trendsData} margin={{ top: 10, right: 44, left: 0, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#64748b' }} />
                          <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#64748b' }} width={40}
                            tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)}
                            label={{ value: 'Footfall', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#94a3b8' }} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#64748b' }} width={40}
                            domain={[0, 100]}
                            label={{ value: 'Uptime %', angle: 90, position: 'insideRight', offset: 10, fontSize: 10, fill: '#94a3b8' }} />
                          <Tooltip content={<DarkTooltip />} />
                          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingBottom: 4 }} verticalAlign="top" />
                          <Bar yAxisId="left" dataKey="footfall" name="Footfall" fill="#00AEEF" radius={[3,3,0,0]} barSize={24} isAnimationActive={!isPrinting} />
                          <Line yAxisId="right" type="monotone" dataKey="uptimePct" name="Employee Uptime %" stroke="#F58220"
                            strokeWidth={2.5} strokeDasharray="5 4" dot={{ r: 3, fill: '#F58220', strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={!isPrinting} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Footfall Demographics */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 print:break-inside-avoid">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-4 rounded-full" style={{ background: '#2E3192' }} />
                    <h2 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500">Footfall Demographics</h2>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={demographicsData} margin={{ top: 20, right: 12, left: 0, bottom: 24 }} barCategoryGap="35%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="gender" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={44}
                        tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
                      <Tooltip content={<DarkTooltip />} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={72} isAnimationActive={!isPrinting}>
                        {demographicsData.map(e => <Cell key={e.gender} fill={e.color} />)}
                        <LabelList dataKey="pct" position="top" formatter={(v: number) => `${v}%`}
                          style={{ fontSize: 10, fontWeight: 700, fill: '#374151' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

              </div>

              {/* ── BILLING KPI ── */}
              <div className="mb-6 print:mb-3">
                <BillingSummary data={billingSummary} hourlyData={billingHourly} isPrinting={isPrinting} />
              </div>

              {/* ── DWELL TIME (half-width, left) ── */}
              <div className="mb-6 print:mb-3 print:break-inside-avoid w-full lg:w-1/2">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
                    <div className="w-1 h-4 rounded-full" style={{ background: '#2E3192' }} />
                    <h2 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500">Dwell Time</h2>
                  </div>
                  <div className="p-5">
                    <p className="text-[10px] font-black uppercase tracking-[2px] text-slate-400 mb-1">Distribution</p>
                    <p className="text-[10px] text-slate-400 mb-2">% of visits by duration</p>
                    {!dwellData || dwellData.total === 0 ? (
                      <div className="flex items-center justify-center h-56 w-full">
                        <div className="h-2 bg-slate-100 rounded animate-pulse w-32" />
                      </div>
                    ) : (
                      <ResponsiveContainer width={isPrinting ? 280 : '100%'} height={240}>
                        <PieChart>
                          <Pie data={dwellPieData} cx="50%" cy="45%" outerRadius={90}
                            dataKey="value" labelLine={false} label={renderDwellLabel}
                            isAnimationActive={!isPrinting}>
                            {dwellPieData.map(e => <Cell key={e.name} fill={e.color} />)}
                          </Pie>
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>


            </>
          )}
        </div>

      </div>
    </ThemeProvider>
  );
}
