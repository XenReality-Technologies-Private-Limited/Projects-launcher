import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AnalysisPage from './pages/AnalysisPage';
import TableClearanceSection from './components/TableClearanceSection';
import AlertsTable from './components/AlertsTable';
import FootfallCharts from './components/FootfallCharts';
import { api, dateToUnix, ClearanceTableState, ClearanceAlert, FootfallStats } from './api';
import { dbApi } from './db/index';

const XENREALITY_LOGO = 'https://d108xxen99ni2a.cloudfront.net/XenRealitylogo.webp';
const SURECOUNT_LOGO  = 'https://d108xxen99ni2a.cloudfront.net/surecountai.png';
const NIKSHAN_LOGO    = 'https://d2uimaqek2eby3.cloudfront.net/Paragon/paragon_logo.jfif';

type Tab = 'dashboard' | 'analysis';
const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'analysis',  label: 'Analysis' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  // Use IST date — toISOString() is UTC which shows yesterday until 5:30 AM IST
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(today);
  const [toDate,   setToDate]   = useState(today);
  const [analysisFrom,       setAnalysisFrom]       = useState(today);
  const [analysisTo,         setAnalysisTo]         = useState(today);
  const [analysisExportOpen, setAnalysisExportOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handlePrint = () => window.print();

  // ── Data state ────────────────────────────────────────────────────────────────
  const [clearanceStates, setClearanceStates] = useState<ClearanceTableState[]>([]);
  const [clearanceAlerts, setClearanceAlerts] = useState<ClearanceAlert[]>([]);
  const [footfallStats,   setFootfallStats]   = useState<FootfallStats | null>(null);
  const [dailyFootfall,   setDailyFootfall]   = useState<{ date: string; footfall: number }[]>([]);
  const [hourlyFootfall,  setHourlyFootfall]  = useState<{ hour: string; footfall: number; dwell?: number }[]>([]);

  useEffect(() => {
    const start = dateToUnix(fromDate);
    const end   = dateToUnix(toDate, true);
    api.clearanceStates().then(setClearanceStates).catch(console.error);
    api.clearanceAlerts(start, end).then(setClearanceAlerts).catch(console.error);
    api.footfallStats(start, end).then(setFootfallStats).catch(console.error);
    dbApi.trend(start, end).then(t => setDailyFootfall((t as any[]).map(p => ({ date: p.date, footfall: p.footfall })))).catch(console.error);
    dbApi.hourly(start, end).then(h => setHourlyFootfall((h as any[]).map(p => ({ hour: p.hour, footfall: p.footfall, dwell: p.dwell })))).catch(console.error);
  }, [fromDate, toDate]);

  useEffect(() => {
    const poll = async () => {
      const start = dateToUnix(fromDate);
      const end   = dateToUnix(toDate, true);
      await dbApi.refreshDb();
      api.clearanceStates().then(setClearanceStates).catch(console.error);
      api.clearanceAlerts(start, end).then(setClearanceAlerts).catch(console.error);
      api.footfallStats(start, end).then(setFootfallStats).catch(console.error);
      dbApi.trend(start, end).then(t => setDailyFootfall((t as any[]).map(p => ({ date: p.date, footfall: p.footfall })))).catch(console.error);
      dbApi.hourly(start, end).then(h => setHourlyFootfall((h as any[]).map(p => ({ hour: p.hour, footfall: p.footfall, dwell: p.dwell })))).catch(console.error);
    };
    const id = setInterval(poll, 60_000);
    return () => clearInterval(id);
  }, [fromDate, toDate]);


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
          }
        `}</style>

        {/* Print-only header */}
        <div className="hidden print:flex items-stretch border-b border-slate-200" style={{ height: 56 }}>
          <div className="flex items-center px-5 shrink-0 xr-logo-block" style={{ background: '#2E3192' }}>
            <img src={XENREALITY_LOGO} alt="XenReality" className="h-7 w-auto object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
          </div>
          <div className="flex items-center gap-2 px-4 border-r border-slate-200 shrink-0">
            <img src={SURECOUNT_LOGO} alt="SureCount AI" style={{ height: 40, maxWidth: 100, objectFit: 'contain' }} />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <span className="font-bold text-sm text-slate-700">XenTrack Dashboard</span>
          </div>
          <div className="flex items-center px-4 shrink-0">
            <img src={NIKSHAN_LOGO} alt="Paragon" style={{ height: 56, maxWidth: 150, objectFit: 'contain' }} />
          </div>
        </div>

        {/* ── STICKY TOP BAR ── */}
        <div className="sticky top-0 z-50 shadow-[0_2px_8px_rgba(0,0,0,0.08)] print:hidden">

          {/* LINE 1: HEADER */}
          <header className="bg-white border-b border-slate-200">
            <div className="relative flex items-stretch h-12 sm:h-14">
              <div className="flex items-center px-5 shrink-0 xr-logo-block" style={{ background: '#2E3192' }}>
                <img src={XENREALITY_LOGO} alt="XenReality" className="h-7 w-auto object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
              </div>
              <div className="flex items-center px-2 sm:px-4 border-r border-slate-200 shrink-0">
                <img src={SURECOUNT_LOGO} alt="SureCount AI" className="h-7 sm:h-12 w-auto object-contain" />
              </div>
              <span className="hidden sm:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-bold text-sm tracking-wide text-slate-700 whitespace-nowrap pointer-events-none">
                XenTrack Dashboard
              </span>
              <div className="flex items-center justify-end flex-1 px-2 sm:px-5 gap-2 sm:gap-5">
                <div className="hidden sm:block overflow-hidden" style={{ width: 44, height: 44, borderRadius: 4, flexShrink: 0 }}>
                  <img src={NIKSHAN_LOGO} alt="Paragon" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-black shrink-0" style={{ background: '#2E3192' }}>
                    {userInitial}
                  </div>
                  <span className="hidden sm:inline text-sm font-semibold text-slate-600 capitalize">{userDisplay}</span>
                </div>
                <button onClick={handleSignOut} className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-red-500 transition-colors">
                  <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                    <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            </div>
            {/* Mobile row 2 */}
            <div className="sm:hidden relative flex items-center px-3 py-2 border-t border-slate-100 bg-white">
              <div className="absolute left-1/2 -translate-x-1/2 overflow-hidden" style={{ width: 44, height: 44, borderRadius: 4 }}>
                <img src={NIKSHAN_LOGO} alt="Paragon" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div className="flex-1" />
              <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:border-[#2E3192] hover:text-[#2E3192] transition-all">
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                  <path d="M4 6V2h8v4M4 12H2V7h12v5h-2M4 9h8v5H4V9z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
                Print
              </button>
            </div>
          </header>

          {/* LINE 2: TABS */}
          <div className="bg-white border-b border-slate-200">
            <div className="px-3 sm:px-6 flex overflow-x-auto">
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`px-4 sm:px-6 py-3 sm:py-3.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                    activeTab === tab.id ? 'border-[#2E3192] text-[#2E3192]' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}>
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
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#2E3192]/30 focus:border-[#2E3192] transition-all" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">To</span>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#2E3192]/30 focus:border-[#2E3192] transition-all" />
              </div>
              <button onClick={handlePrint}
                className="hidden sm:flex items-center gap-2 ml-auto px-4 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:border-[#2E3192] hover:text-[#2E3192] transition-all">
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                  <path d="M4 6V2h8v4M4 12H2V7h12v5h-2M4 9h8v5H4V9z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
                Print
              </button>
            </div>
          )}
          {activeTab === 'analysis' && (
            <div className="bg-[#fafbff] border-b border-slate-100 px-3 sm:px-6 py-2 sm:py-3 flex flex-wrap items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">From</span>
                <input type="date" value={analysisFrom} onChange={e => setAnalysisFrom(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#2E3192]/30 focus:border-[#2E3192] transition-all" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">To</span>
                <input type="date" value={analysisTo} onChange={e => setAnalysisTo(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#2E3192]/30 focus:border-[#2E3192] transition-all" />
              </div>
              <button onClick={() => setAnalysisExportOpen(true)}
                className="flex items-center gap-2 ml-auto px-4 py-1.5 rounded-lg bg-[#2E3192] text-white text-sm font-bold hover:bg-[#252880] transition-colors shadow-sm">
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
          {activeTab === 'analysis' ? (
            <AnalysisPage fromDate={analysisFrom} toDate={analysisTo} exportOpen={analysisExportOpen} onExportClose={() => setAnalysisExportOpen(false)} />
          ) : (
            <>
          {/* ── FOOTFALL ── */}
          <div className="mt-4 print:break-inside-avoid">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 rounded-full" style={{ background: '#2E3192' }} />
              <h2 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500">Footfall</h2>
            </div>
            <FootfallCharts stats={footfallStats} daily={dailyFootfall} hourly={hourlyFootfall} />
          </div>

          {/* ── TABLE STATES ── */}
          <div className="mt-6 print:break-inside-avoid">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 rounded-full" style={{ background: '#2E3192' }} />
              <h2 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500">Table States</h2>
            </div>
            <TableClearanceSection states={clearanceStates} />
          </div>

          {/* ── ALERTS ── */}
          <div className="mt-6 print:break-inside-avoid">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 rounded-full" style={{ background: '#2E3192' }} />
              <h2 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500">Alerts</h2>
            </div>
            <AlertsTable alerts={clearanceAlerts} />
          </div>
            </>
          )}
        </div>
      </div>
    </ThemeProvider>
  );
}
