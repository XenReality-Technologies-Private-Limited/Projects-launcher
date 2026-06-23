import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import DeviceStatusPage from './pages/DeviceStatusPage';
import AnalysisPage from './pages/AnalysisPage';
import { AreaChart, Area, BarChart, Bar, ComposedChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { api, dateToUnix, fmtCount, minsToMmSs, SummaryData, TrendPoint, HourlyPoint } from './api';


const XENREALITY_LOGO = 'https://d108xxen99ni2a.cloudfront.net/XenRealitylogo.webp';
const SURECOUNT_LOGO  = 'https://d108xxen99ni2a.cloudfront.net/surecountai.png';
const SULTAN_LOGO     = 'https://d108xxen99ni2a.cloudfront.net/sultan_logo.png';

type Tab = 'dashboard' | 'device-status' | 'analysis';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard',     label: 'Dashboard' },
  { id: 'analysis',      label: 'Analysis' },
  { id: 'device-status', label: 'Device Status' },
];

const STORES = ['All Stores', '0001'];
const CITIES = ['All Cities', 'Bangalore'];
const STATES = ['All States', 'Karnataka'];

interface KpiCard {
  label: string;
  value: string;
  color: string;
  sub?: string | null;
  subLabel?: string;
}

const KPI_CARDS: KpiCard[] = [
  { label: 'Passer By',        value: '—', color: '#2E3192' },
  { label: 'Footfall',         value: '—', color: '#00AEEF' },
  { label: 'Greeted Count',    value: '—', color: '#00A651' },
  { label: 'Unattended Count', value: '—', color: '#EF4444' },
  { label: 'Avg Dwell Time',   value: '—', color: '#FACC15' },
];

const PERIODS = ['Current Period', 'Today', 'This Week', 'Last Week', 'This Month', 'Last Month'];

// ── Period comparison helpers ─────────────────────────────────────────────────

type PeriodMetrics = {
  passerBy: number;
  footfall: number;
  greetedPct: number;
  unattendedPct: number;
};

function extractMetrics(s: SummaryData): PeriodMetrics {
  return {
    passerBy:      s.passerby.total,
    footfall:      s.footfall.total,
    greetedPct:    s.greetings.greetingPercent,
    unattendedPct: s.greetings.unattendedPercent,
  };
}

function fmtMetricVal(key: keyof PeriodMetrics, val: number): string {
  if (key === 'greetedPct' || key === 'unattendedPct') {
    return `${Number(val).toFixed(1)}%`;
  }
  return fmtCount(val);
}

function calcChange(base: number, comp: number, isRate: boolean): string | null {
  if (!base || !comp) return null;
  if (isRate) {
    const diff = +(comp - base).toFixed(1);
    return `${diff >= 0 ? '+' : ''}${diff}%`;
  }
  const pct = +((comp - base) / base * 100).toFixed(1);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

const COMPARISON_KPI_DEFS: Array<{ kpi: string; key: keyof PeriodMetrics; isRate: boolean }> = [
  { kpi: 'Passer By',    key: 'passerBy',      isRate: false },
  { kpi: 'Footfall',     key: 'footfall',      isRate: false },
  { kpi: 'Greeted %',    key: 'greetedPct',    isRate: true  },
  { kpi: 'Unattended %', key: 'unattendedPct', isRate: true  },
];

const KPI_TREND_OPTIONS = [
  { key: 'passerBy',   label: 'Passer By',  color: '#2E3192' },
  { key: 'footfall',   label: 'Footfall',   color: '#00AEEF' },
  { key: 'greeted',    label: 'Greeted',    color: '#00A651' },
  { key: 'unattended', label: 'Unattended', color: '#EF4444' },
];

function renderDwellLabel(props: any) {
  const { cx, cy, midAngle, outerRadius, pct } = props;
  const RAD = Math.PI / 180;
  const x = cx + outerRadius * 0.65 * Math.cos(-midAngle * RAD);
  const y = cy + outerRadius * 0.65 * Math.sin(-midAngle * RAD);
  return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700}>{pct}</text>;
}

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
        const isPct   = key.toLowerCase().endsWith('pct') || key.toLowerCase().includes('percent');
        const isDwell = key === 'dwell';
        const baseVal = isPct
          ? `${Number(v).toFixed(1)}%`
          : isDwell ? `${Number(v).toFixed(1)} min`
          : v >= 1000000 ? `${(v / 1000000).toFixed(2)}M`
          : v >= 1000  ? `${(v / 1000).toFixed(1)}K`
          : String(v ?? 0);
        const extraPct = p.payload?.pct;
        const pctNote = extraPct != null
          ? ` (${typeof extraPct === 'string' ? extraPct : `${extraPct}%`})`
          : '';
        const name = p.payload?.gender ?? p.name;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: i < payload.length - 1 ? 4 : 0 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: p.color ?? p.fill, flexShrink: 0 }} />
            <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{name}:</span>
            <span style={{ color: 'white', fontWeight: 600, fontSize: 12, marginLeft: 2 }}>{baseVal}{pctNote}</span>
          </div>
        );
      })}
    </div>
  );
}


export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const today = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [store, setStore] = useState('All Stores');
  const [city, setCity] = useState('All Cities');
  const [state, setState] = useState('All States');
  const [analysisFrom, setAnalysisFrom] = useState(today);
  const [analysisTo, setAnalysisTo] = useState(today);
  const [analysisStore, setAnalysisStore] = useState('All Stores');
  const [analysisCity, setAnalysisCity] = useState('All Cities');
  const [analysisState, setAnalysisState] = useState('All States');
  const [analysisExportOpen, setAnalysisExportOpen] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState('passerBy');
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

  // ── Print: fix Recharts blank-chart issue by using fixed widths before snapshot ─
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

  // ── Real data from API (falls back to mock constants while loading) ──────────
  const [summary, setSummary]       = useState<SummaryData | null>(null);
  const [trendData, setTrendData]   = useState<TrendPoint[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyPoint[]>([]);
  // periodSummaries: null=loading, false=error, SummaryData=loaded
  const [periodSummaries, setPeriodSummaries] = useState<(SummaryData | null | false)[]>([null, null, null, null, null]);

  useEffect(() => {
    const start = dateToUnix(fromDate);
    const end   = dateToUnix(toDate, true);
    api.summary(start, end).then(setSummary).catch(console.error);
    api.trend(start, end).then(setTrendData).catch(console.error);
    api.hourly(start, end).then(setHourlyData).catch(console.error);
  }, [fromDate, toDate]);

  useEffect(() => {
    api.periods()
      .then(d => setPeriodSummaries([d.today, d.thisWeek, d.lastWeek, d.thisMonth, d.lastMonth]))
      .catch(() => setPeriodSummaries([false, false, false, false, false]));
  }, []);

  // ── Derive chart data from summary ───────────────────────────────────────────

  const funnelData = (() => {
    const rows = summary ? [
      { name: 'Passer By',  value: summary.passerby.total,        color: '#2E3192' },
      { name: 'Footfall',   value: summary.footfall.total,        color: '#00AEEF' },
      { name: 'Greeted',    value: summary.greetings.greeted,     color: '#00A651' },
      { name: 'Unattended', value: summary.greetings.unattended,  color: '#EF4444' },
    ] : [
      { name: 'Passer By',  value: 0, color: '#2E3192' },
      { name: 'Footfall',   value: 0, color: '#00AEEF' },
      { name: 'Greeted',    value: 0, color: '#00A651' },
      { name: 'Unattended', value: 0, color: '#EF4444' },
    ];
    const top = rows[0].value || 1;
    return rows.map(d => ({ ...d, pct: (d.value / top * 100).toFixed(1) }));
  })();

  const dwellPieData = summary ? (() => {
    const { lessThan2, twoTo10, moreThan10 } = summary.dwellTime;
    const tot = lessThan2 + twoTo10 + moreThan10;
    return [
      { name: '< 2 min',  value: lessThan2,  pct: tot ? `${(lessThan2  / tot * 100).toFixed(1)}%` : '0%', color: '#F58220' },
      { name: '2–10 min', value: twoTo10,    pct: tot ? `${(twoTo10   / tot * 100).toFixed(1)}%` : '0%', color: '#2E3192' },
      { name: '> 10 min', value: moreThan10, pct: tot ? `${(moreThan10 / tot * 100).toFixed(1)}%` : '0%', color: '#00A651' },
    ];
  })() : [
    { name: '< 2 min',  value: 0, pct: '0%', color: '#F58220' },
    { name: '2–10 min', value: 0, pct: '0%', color: '#2E3192' },
    { name: '> 10 min', value: 0, pct: '0%', color: '#00A651' },
  ];

  const dwellAvg = summary ? minsToMmSs(summary.dwellTime.average) : '—';

  const demographicsData = summary ? [
    {
      category: 'Footfall',
      male: summary.footfall.male, female: summary.footfall.female, child: summary.footfall.children,
      malePct: summary.footfall.malePercent, femalePct: summary.footfall.femalePercent, childPct: summary.footfall.childPercent,
    },
    {
      category: 'Passer By',
      male: summary.passerby.male, female: summary.passerby.female, child: summary.passerby.children,
      malePct: summary.passerby.malePercent, femalePct: summary.passerby.femalePercent, childPct: summary.passerby.childPercent,
    },
  ] : [
    { category: 'Footfall',  male: 0, female: 0, child: 0, malePct: 0, femalePct: 0, childPct: 0 },
    { category: 'Passer By', male: 0, female: 0, child: 0, malePct: 0, femalePct: 0, childPct: 0 },
  ];

  const kpiCards: KpiCard[] = summary ? [
    { label: 'Passer By',        value: fmtCount(summary.passerby.total),  color: '#2E3192' },
    { label: 'Footfall',         value: fmtCount(summary.footfall.total),  color: '#00AEEF' },
    {
      label: 'Greeted Count',
      value: fmtCount(summary.greetings.greeted),
      color: '#00A651',
      sub: `${summary.greetings.greetingPercent}%`,
      subLabel: 'Greeted %',
    },
    {
      label: 'Unattended Count',
      value: fmtCount(summary.greetings.unattended),
      color: '#EF4444',
      sub: `${summary.greetings.unattendedPercent}%`,
      subLabel: 'Unattended %',
    },
    {
      label: 'Avg Dwell Time',
      value: summary.dwellTime.average > 0 ? `${dwellAvg} min` : 'N/A',
      color: '#FACC15',
    },
  ] : KPI_CARDS;

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
          <div className="flex items-center gap-2 px-4 border-r border-slate-200 shrink-0">
            <img src={SURECOUNT_LOGO} alt="SureCount AI" style={{ height: 32, maxWidth: 80, objectFit: 'contain' }} />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <span className="font-bold text-sm text-slate-700">Sultan Dashboard</span>
          </div>
          <div className="flex items-center px-4 shrink-0">
            <img src={SULTAN_LOGO} alt="Sultan" style={{ height: 28, maxWidth: 110, objectFit: 'contain' }} />
          </div>
        </div>

        {/* ── STICKY TOP BAR: header + tabs + filter ── */}
        <div className="sticky top-0 z-50 shadow-[0_2px_8px_rgba(0,0,0,0.08)] print:hidden">

          {/* LINE 1: HEADER */}
          <header className="bg-white border-b border-slate-200">
            <div className="relative flex items-stretch h-12 sm:h-14">
            {/* Blue XenReality block */}
            <div
              className="flex items-center px-5 shrink-0 xr-logo-block"
              style={{ background: '#2E3192' }}
            >
              <img
                src={XENREALITY_LOGO}
                alt="XenReality"
                className="h-7 w-auto object-contain"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            </div>

            {/* SureCount logo */}
            <div className="flex items-center px-2 sm:px-4 border-r border-slate-200 shrink-0">
              <img src={SURECOUNT_LOGO} alt="SureCount AI" className="h-7 sm:h-12 print:h-8 print:max-w-[80px] w-auto object-contain" />
            </div>

            {/* XenTrack Dashboard — absolutely centred, hidden on small screens and in print */}
            <span className="hidden sm:block print:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-bold text-sm tracking-wide text-slate-700 whitespace-nowrap pointer-events-none">
              XenTrack Dashboard
            </span>

            {/* Right items */}
            <div className="flex items-center justify-end flex-1 px-2 sm:px-5 gap-2 sm:gap-5">
              <img src={SULTAN_LOGO} alt="Sultan" className="hidden sm:block h-8 print:h-7 print:max-w-[110px] w-auto object-contain" />
              <div className="flex items-center gap-2 print:hidden">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-black shrink-0"
                  style={{ background: '#2E3192' }}
                >
                  {userInitial}
                </div>
                <span className="hidden sm:inline text-sm font-semibold text-slate-600 capitalize">{userDisplay}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-red-500 transition-colors print:hidden"
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                  <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M10 11l3-3-3-3M13 8H6"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
            </div>{/* end row 1 */}
            {/* Row 2: mobile only — Sultan logo centred + Print */}
            <div className="sm:hidden relative flex items-center px-3 py-2 border-t border-slate-100 bg-white">
              <div className="absolute left-1/2 -translate-x-1/2">
                <img src={SULTAN_LOGO} alt="Sultan" className="h-6 w-auto object-contain" />
              </div>
              <div className="flex-1" />
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:border-[#2E3192] hover:text-[#2E3192] transition-all"
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                  <path d="M4 6V2h8v4M4 12H2V7h12v5h-2M4 9h8v5H4V9z"
                    stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
                Print
              </button>
            </div>
          </header>

          {/* LINE 2: TABS */}
          <div className="bg-white border-b border-slate-200">
            <div className="px-3 sm:px-6 flex overflow-x-auto">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 sm:px-6 py-3 sm:py-3.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-[#2E3192] text-[#2E3192]'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* LINE 3: FILTER BAR */}
          {activeTab === 'dashboard' && (
            <div className="bg-[#fafbff] border-b border-slate-100 px-3 sm:px-6 py-2 sm:py-3 flex flex-wrap items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">From</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#2E3192]/30 focus:border-[#2E3192] transition-all"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">To</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#2E3192]/30 focus:border-[#2E3192] transition-all"
                />
              </div>
              {/* Force line break on mobile: From+To on row 1, dropdowns on row 2 */}
              <div className="w-full sm:hidden" />
              <select
                value={store}
                onChange={e => setStore(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#2E3192]/30 focus:border-[#2E3192] cursor-pointer transition-all"
              >
                {STORES.map(o => <option key={o}>{o}</option>)}
              </select>
              <select
                value={city}
                onChange={e => setCity(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#2E3192]/30 focus:border-[#2E3192] cursor-pointer transition-all"
              >
                {CITIES.map(o => <option key={o}>{o}</option>)}
              </select>
              <select
                value={state}
                onChange={e => setState(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#2E3192]/30 focus:border-[#2E3192] cursor-pointer transition-all"
              >
                {STATES.map(o => <option key={o}>{o}</option>)}
              </select>
              {/* Print visible on desktop only; mobile Print lives in header row 2 */}
              <button
                onClick={handlePrint}
                className="hidden sm:flex items-center gap-2 ml-auto px-4 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:border-[#2E3192] hover:text-[#2E3192] transition-all"
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                  <path d="M4 6V2h8v4M4 12H2V7h12v5h-2M4 9h8v5H4V9z"
                    stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
                Print
              </button>
            </div>
          )}
          {activeTab === 'analysis' && (
            <div className="bg-[#fafbff] border-b border-slate-100 px-3 sm:px-6 py-2 sm:py-3 flex flex-wrap items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">From</span>
                <input
                  type="date"
                  value={analysisFrom}
                  onChange={e => setAnalysisFrom(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#2E3192]/30 focus:border-[#2E3192] transition-all"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">To</span>
                <input
                  type="date"
                  value={analysisTo}
                  onChange={e => setAnalysisTo(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#2E3192]/30 focus:border-[#2E3192] transition-all"
                />
              </div>
              <div className="w-full sm:hidden" />
              <select
                value={analysisStore}
                onChange={e => setAnalysisStore(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#2E3192]/30 focus:border-[#2E3192] cursor-pointer transition-all"
              >
                {STORES.map(o => <option key={o}>{o}</option>)}
              </select>
              <select
                value={analysisCity}
                onChange={e => setAnalysisCity(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#2E3192]/30 focus:border-[#2E3192] cursor-pointer transition-all"
              >
                {CITIES.map(o => <option key={o}>{o}</option>)}
              </select>
              <select
                value={analysisState}
                onChange={e => setAnalysisState(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#2E3192]/30 focus:border-[#2E3192] cursor-pointer transition-all"
              >
                {STATES.map(o => <option key={o}>{o}</option>)}
              </select>
              <button
                onClick={() => setAnalysisExportOpen(true)}
                className="flex items-center gap-2 ml-auto px-4 py-1.5 rounded-lg bg-[#2E3192] text-white text-sm font-bold hover:bg-[#252880] transition-colors shadow-sm"
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                  <path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Export Report
              </button>
            </div>
          )}

        </div>{/* end sticky */}

        {/* ── PAGE CONTENT ── */}
        <div className="px-3 sm:px-6 py-4 sm:py-5 max-w-screen-2xl mx-auto">

          {activeTab === 'device-status' ? (
            <DeviceStatusPage />
          ) : activeTab === 'analysis' ? (
            <AnalysisPage fromDate={analysisFrom} toDate={analysisTo} exportOpen={analysisExportOpen} onExportClose={() => setAnalysisExportOpen(false)} />
          ) : (
            <>
              {/* ── KEY PERFORMANCE INDICATORS ── */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full" style={{ background: '#2E3192' }} />
                  <h2 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500">
                    Key Performance Indicators
                  </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {summary === null
                    ? KPI_CARDS.map((kpi, i) => (
                        <div key={i} className="rounded-xl shadow-sm p-4 space-y-2 animate-pulse"
                          style={{ border: `1.5px solid ${kpi.color}`, background: `${kpi.color}18` }}>
                          <div className="h-2 bg-white/60 rounded w-14" />
                          <div className="h-7 bg-white/60 rounded w-20" />
                        </div>
                      ))
                    : kpiCards.map(kpi => (
                        <div
                          key={kpi.label}
                          className="rounded-xl shadow-sm cursor-default hover:shadow-md hover:-translate-y-0.5 transition-all p-4"
                          style={{ border: `1.5px solid ${kpi.color}`, background: `${kpi.color}18` }}
                        >
                          <p className="text-[9px] font-black uppercase tracking-[2px] text-slate-500 mb-2 leading-tight">{kpi.label}</p>
                          <p className="text-2xl font-black text-slate-800 leading-none">{kpi.value}</p>
                          {kpi.sub && (
                            <p className="text-xs font-bold mt-2 leading-none" style={{ color: kpi.color }}>
                              {kpi.sub}{' '}
                              <span className="text-slate-400 font-normal text-[10px]">{kpi.subLabel}</span>
                            </p>
                          )}
                        </div>
                      ))
                  }
                </div>
              </div>

              {/* ── KPI COMPARISONS ── */}
              {(() => {
                const allMetrics: (PeriodMetrics | null)[] = [
                  summary ? extractMetrics(summary) : null,
                  ...periodSummaries.map(s => (s && s !== false) ? extractMetrics(s as SummaryData) : null),
                ];
                const baseMetrics = allMetrics[0];

                return (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1 h-4 rounded-full" style={{ background: '#2E3192' }} />
                      <h2 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500">KPI Comparisons</h2>
                    </div>
                    <div className="overflow-x-auto -mx-3 sm:mx-0">
                    <div className="grid grid-cols-6 gap-2 min-w-[700px] px-3 sm:px-0">
                      {PERIODS.map((period, pi) => {
                        const m = allMetrics[pi];
                        const raw = pi > 0 ? periodSummaries[pi - 1] : summary;
                        const isLoading = pi > 0 && raw === null;
                        const isError   = pi > 0 && raw === false;
                        return (
                          <div
                            key={period}
                            className="bg-white rounded-xl shadow-sm overflow-hidden min-w-0"
                            style={{ border: pi === 0 ? '1.5px solid #cbd5e1' : '1px solid #e2e8f0' }}
                          >
                            {/* Period title */}
                            <div
                              className="px-3 py-2 border-b border-slate-100"
                              style={{ background: pi === 0 ? '#f1f5f9' : undefined }}
                            >
                              <p className="text-[10px] font-black uppercase tracking-[1px] text-slate-800">
                                {period}
                              </p>
                            </div>

                            {/* KPI rows */}
                            <div className="px-3 py-2.5 space-y-2">
                              {isLoading ? (
                                <p className="text-[10px] text-slate-400 text-center py-1">Loading…</p>
                              ) : isError ? (
                                <p className="text-[10px] text-red-400 text-center py-1">Unavailable</p>
                              ) : (
                                COMPARISON_KPI_DEFS.map(({ kpi, key, isRate }) => {
                                  const val = m ? fmtMetricVal(key, m[key]) : '—';
                                  const change = pi > 0 && m && baseMetrics
                                    ? calcChange(baseMetrics[key], m[key], isRate)
                                    : null;
                                  return (
                                    <div key={kpi} className="flex items-center justify-between gap-1 min-w-0">
                                      <span className="text-[11px] text-slate-500 font-medium truncate shrink">{kpi}</span>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <span className="text-[13px] font-black text-slate-800">{val}</span>
                                        {change && (
                                          <span className={`text-[10px] font-bold ${change.startsWith('+') ? 'text-emerald-500' : 'text-red-400'}`}>
                                            {change}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    </div>{/* end overflow-x-auto */}
                  </div>
                );
              })()}

              {/* ── CHARTS ── */}
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 print:grid-cols-1 gap-4 sm:gap-6">

                {/* KPI Trend Distribution */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 print:break-inside-avoid">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 rounded-full" style={{ background: '#2E3192' }} />
                      <h2 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500">KPI Trend Distribution</h2>
                    </div>
                    <select
                      value={selectedKpi}
                      onChange={e => setSelectedKpi(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#2E3192]/30 focus:border-[#2E3192] cursor-pointer"
                    >
                      {KPI_TREND_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                  </div>
                  {/* key forces AreaChart remount → bottom-up animation on KPI switch */}
                  <div key={selectedKpi} style={{ width: '100%', height: 280 }}>
                    {(() => {
                      const kpiOpt   = KPI_TREND_OPTIONS.find(o => o.key === selectedKpi);
                      const kpiColor = kpiOpt?.color ?? '#2E3192';
                      const isSingleDay = trendData.length <= 1;
                      const chartData = isSingleDay
                        ? hourlyData.map(h => ({
                            date: h.hour,
                            passerBy:   h.passerBy,
                            footfall:   h.footfall,
                            trials:     h.trials,
                            greeted:    Math.round(h.footfall * h.greetedPct    / 100),
                            unattended: Math.round(h.footfall * h.unattendedPct / 100),
                            billing:    h.billing,
                          }))
                        : trendData;
                      const xLabel = isSingleDay ? 'Hour' : 'Date';
                      return (
                        <ResponsiveContainer width={isPrinting ? 580 : "100%"} height="100%">
                          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 30 }}>
                            <defs>
                              <linearGradient id="kpiAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor={kpiColor} stopOpacity={0.28} />
                                <stop offset="95%" stopColor={kpiColor} stopOpacity={0}    />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 11, fill: '#64748b' }}
                              label={{ value: xLabel, position: 'insideBottom', offset: -15, fontSize: 11, fill: '#94a3b8' }}
                            />
                            <YAxis
                              tick={{ fontSize: 11, fill: '#64748b' }}
                              tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}K`}
                              label={{ value: kpiOpt?.label, angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#94a3b8' }}
                            />
                            <Tooltip content={<DarkTooltip />} />
                            <Area
                              type="monotone"
                              dataKey={selectedKpi}
                              name={kpiOpt?.label}
                              stroke={kpiColor}
                              strokeWidth={2.5}
                              fill="url(#kpiAreaGradient)"
                              dot={{ r: 3, fill: kpiColor, strokeWidth: 0 }}
                              activeDot={{ r: 5 }}
                              isAnimationActive={!isPrinting}
                              animationBegin={0}
                              animationDuration={700}
                              animationEasing="ease-out"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>
                </div>

                {/* KPI Trend Total / Funnel */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 print:break-inside-avoid">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-4 rounded-full" style={{ background: '#2E3192' }} />
                    <h2 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500">KPI Trend Total</h2>
                  </div>
                  <ResponsiveContainer width={isPrinting ? 580 : "100%"} height={280}>
                    <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: isMobile ? 70 : 145, left: 10, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}K`}
                        label={{ value: 'Count', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#94a3b8' }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        width={82}
                      />
                      <Tooltip content={<DarkTooltip />} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={22} isAnimationActive={!isPrinting}>
                        {funnelData.map(entry => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                        <LabelList
                          dataKey="value"
                          position="right"
                          content={(props: any) => {
                            const { x, y, width, height, value, index } = props;
                            const item = funnelData[index];
                            if (!item) return null;
                            const count = value >= 1000000
                              ? `${(value / 1000000).toFixed(2)}M`
                              : `${(value / 1000).toFixed(1)}K`;
                            return (
                              <text
                                x={x + width + 6}
                                y={y + height / 2}
                                fill="#374151"
                                fontSize={11}
                                fontWeight={700}
                                dominantBaseline="middle"
                              >
                                {isMobile ? count : `${count} (${item.pct}%)`}
                              </text>
                            );
                          }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

              </div>

              {/* ── DWELL TIME + DEMOGRAPHICS ── */}
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 print:grid-cols-1 gap-4 sm:gap-6">

                {/* Dwell Time PieChart */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 print:break-inside-avoid">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 rounded-full" style={{ background: '#2E3192' }} />
                      <h2 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500">Dwell Time</h2>
                    </div>
                    <div className="text-right bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                      <p className="text-[9px] font-black uppercase tracking-[2px] text-slate-400 mb-0.5">Avg Dwell Time</p>
                      <p className="text-xl font-black leading-none" style={{ color: '#2E3192' }}>{dwellAvg}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">MM : SS</p>
                    </div>
                  </div>
                  <ResponsiveContainer width={isPrinting ? 580 : '100%'} height={280}>
                    <PieChart>
                      <Pie data={dwellPieData} cx="50%" cy="45%" outerRadius={105} dataKey="value" labelLine={false} label={renderDwellLabel} isAnimationActive={!isPrinting}>
                        {dwellPieData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<DarkTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Demographics */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 print:break-inside-avoid">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-4 rounded-full" style={{ background: '#2E3192' }} />
                    <h2 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500">Demographics</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[{ title: 'Footfall', d: demographicsData[0] }, { title: 'Passer By', d: demographicsData[1] }].map(({ title, d }) => {
                      const chartData = [
                        { gender: 'Male',   value: d.male,   pct: d.malePct,   color: '#2E3192' },
                        { gender: 'Female', value: d.female, pct: d.femalePct, color: '#EC4899' },
                        { gender: 'Child',  value: d.child,  pct: d.childPct,  color: '#FACC15' },
                      ];
                      return (
                        <div key={title}>
                          <p className="text-[10px] font-black uppercase tracking-[2px] text-slate-400 text-center mb-1">{title}</p>
                          <ResponsiveContainer width={isPrinting ? 260 : '100%'} height={340}>
                            <BarChart data={chartData} margin={{ top: 22, right: 8, left: 0, bottom: 40 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="gender" tick={{ fontSize: 10, fill: '#64748b' }} angle={-30} textAnchor="end" height={45} interval={0} label={{ value: 'Gender', position: 'insideBottom', offset: -5, fontSize: 9, fill: '#94a3b8' }} />
                              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={42} tickFormatter={(v: number) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} label={{ value: 'Count', angle: -90, position: 'insideLeft', offset: 12, fontSize: 9, fill: '#94a3b8' }} />
                              <Tooltip content={<DarkTooltip />} />
                              <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={!isPrinting}>
                                {chartData.map(e => <Cell key={e.gender} fill={e.color} />)}
                                <LabelList dataKey="pct" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 10, fontWeight: 700, fill: '#374151' }} />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ── KPI TRENDS THROUGH THE DAY ── */}
              <div className="mt-6 print:break-inside-avoid">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-4 rounded-full" style={{ background: '#2E3192' }} />
                    <h2 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500">KPI Trends Through the Day</h2>
                  </div>
                  <ResponsiveContainer width={isPrinting ? 700 : '100%'} height={370}>
                    <ComposedChart data={hourlyData} margin={{ top: 10, right: isMobile ? 4 : 45, left: isMobile ? 0 : 20, bottom: 40 }} barCategoryGap="28%" barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#64748b' }} label={{ value: 'Time of Day', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis yAxisId="count" orientation="left" width={isMobile ? 36 : 60} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : `${v}`} label={{ value: 'Count', angle: -90, position: 'insideLeft', offset: isMobile ? 14 : 10, fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis yAxisId="pct" orientation="right" width={isMobile ? 36 : 60} domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v: number) => `${v}%`} label={{ value: 'Rate %', angle: 90, position: 'insideRight', offset: isMobile ? 14 : 15, fontSize: 11, fill: '#94a3b8' }} />
                      <Tooltip content={<DarkTooltip />} />
                      <Legend iconType="circle" iconSize={8} verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 12 }} />
                      <Bar yAxisId="count" dataKey="passerBy"      name="Passer By"    fill="#2E3192" fillOpacity={0.18} stroke="#2E3192" strokeWidth={2} radius={[2,2,0,0]} barSize={isMobile ? 10 : 20} isAnimationActive={!isPrinting} />
                      <Bar yAxisId="count" dataKey="footfall"      name="Footfall"     fill="#00AEEF" fillOpacity={0.18} stroke="#00AEEF" strokeWidth={2} radius={[2,2,0,0]} barSize={isMobile ? 10 : 20} isAnimationActive={!isPrinting} />
                      <Line yAxisId="pct" type="monotone" dataKey="greetedPct"    name="Greeted %"    stroke="#00A651" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3, fill: '#00A651', strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={!isPrinting} />
                      <Line yAxisId="pct" type="monotone" dataKey="unattendedPct" name="Unattended %"  stroke="#EF4444" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3, fill: '#EF4444', strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={!isPrinting} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </>
          )}
        </div>

      </div>
    </ThemeProvider>
  );
}
