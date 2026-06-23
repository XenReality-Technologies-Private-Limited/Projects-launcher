import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const XENREALITY_LOGO = 'https://d108xxen99ni2a.cloudfront.net/XenRealitylogo.webp';
const SURECOUNT_LOGO  = 'https://d108xxen99ni2a.cloudfront.net/surecountai.png';
const NIKSHAN_LOGO    = 'https://d2uimaqek2eby3.cloudfront.net/Paragon/paragon_logo.jfif';

function XenRealityLogo({ variant = 'dark', size = 'md' }: { variant?: 'light' | 'dark'; size?: 'sm' | 'md' | 'lg' }) {
  const h = size === 'lg' ? 'h-11' : size === 'sm' ? 'h-6' : 'h-8';
  return (
    <img
      src={XENREALITY_LOGO}
      alt="XenReality"
      className={`${h} w-auto object-contain`}
      style={{ filter: variant === 'light' ? 'brightness(0) invert(1)' : 'none' }}
    />
  );
}

function SureCountLogo({ variant = 'dark', size = 'md' }: { variant?: 'light' | 'dark'; size?: 'sm' | 'md' | 'lg' }) {
  const h = size === 'lg' ? 'h-14' : size === 'sm' ? 'h-7' : 'h-9';
  return (
    <img
      src={SURECOUNT_LOGO}
      alt="SureCount AI"
      className={`${h} w-auto object-contain`}
      style={{ filter: variant === 'light' ? 'brightness(0) invert(1)' : 'none' }}
    />
  );
}


export default function LoginPage() {
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(identity, password);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials. Please try again.';
      setError(msg.includes('Failed to authenticate') || msg.includes('400')
        ? 'Invalid username or password.'
        : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center font-sans p-4 md:p-8" style={{ background: '#2E3192' }}>
      {/* ── CENTERED CARD ── */}
      <div className="w-full max-w-6xl flex flex-col md:flex-row rounded-3xl overflow-hidden shadow-[0_24px_80px_-12px_rgba(0,0,0,0.4)] min-h-[620px]" style={{ border: '1px solid rgba(255,255,255,0.18)' }}>

        {/* ── LEFT PANEL ── */}
        <div
          className="relative flex flex-col justify-between md:w-[54%] p-10 md:p-14 overflow-hidden"
          style={{ background: 'linear-gradient(145deg, #2E3192 0%, #1a1d6e 55%, #020617 100%)' }}
        >
          {/* Background geometric accent */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10"
              style={{ background: 'radial-gradient(circle, #00AEEF 0%, transparent 70%)' }} />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full opacity-8"
              style={{ background: 'radial-gradient(circle, #F58220 0%, transparent 70%)' }} />
            <svg className="absolute right-0 top-1/4 opacity-5 w-72" viewBox="0 0 200 200" fill="none">
              <circle cx="100" cy="100" r="90" stroke="white" strokeWidth="1" />
              <circle cx="100" cy="100" r="60" stroke="white" strokeWidth="1" />
              <circle cx="100" cy="100" r="30" stroke="white" strokeWidth="1" />
            </svg>
          </div>

          {/* Top: Partnership logo bar */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-5 px-6 py-4 rounded-2xl bg-white shadow-sm">
              <XenRealityLogo variant="dark" size="lg" />
              <span className="text-slate-300 font-light text-2xl">×</span>
              <SureCountLogo variant="dark" size="lg" />
            </div>
          </div>

          {/* Middle: Main copy */}
          <div className="relative z-10 flex-1 flex flex-col justify-center py-10 md:py-0">
            <h1 className="text-5xl md:text-6xl font-black text-white leading-none mb-2">
              XenTrack
            </h1>
            <span className="text-[11px] font-black uppercase tracking-[4px] text-[#00AEEF] mb-6 block">AI-Powered Video Analytics</span>

            <p className="text-2xl md:text-3xl font-black text-white leading-snug mb-5">
              Real-time tracking of activities in Retail spaces.
            </p>

            <p className="text-white/65 text-base leading-relaxed max-w-sm">
              Boost business performance with footfall counting, dwell time analytics and heatmaps that turn customer movement into sales insights.
            </p>
          </div>

          {/* Bottom: Contact */}
          <div className="relative z-10 flex flex-col gap-2">
            <a href="mailto:support@xenreality.com" className="flex items-center gap-2 text-white/45 hover:text-white/70 transition-colors text-xs">
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 shrink-0">
                <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" />
                <path d="M1 5l7 5 7-5" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              support@xenreality.com
            </a>
            <a href="https://xenreality.com" target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-white/45 hover:text-white/70 transition-colors text-xs">
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 shrink-0">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" />
                <path d="M8 1C8 1 5 4 5 8s3 7 3 7M8 1c0 0 3 3 3 7s-3 7-3 7M1 8h14" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              xenreality.com
            </a>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="flex-1 flex items-center justify-center bg-[#f8f9fc] p-10 md:p-14">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <div className="flex justify-center mb-6">
                <div className="overflow-hidden" style={{ width: 160, height: 160, borderRadius: 8 }}>
                  <img src={NIKSHAN_LOGO} alt="Paragon" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              </div>
              <h2 className="text-3xl font-black text-[#2E3192] mb-2">Sign In</h2>
              <p className="text-sm text-slate-500">Enter credentials to access dashboard.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[2px] text-slate-500 mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                      <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M2 13c0-2.21 2.686-4 6-4s6 1.79 6 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={identity}
                    onChange={e => setIdentity(e.target.value)}
                    placeholder="Enter username or email"
                    required
                    className="w-full pl-9 pr-3 py-3.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E3192]/30 focus:border-[#2E3192] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-[2px] text-slate-500 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                      <rect x="2" y="7" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      <circle cx="8" cy="11" r="1" fill="currentColor" />
                    </svg>
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    className="w-full pl-9 pr-3 py-3.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E3192]/30 focus:border-[#2E3192] transition-all"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
                  <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-red-500 shrink-0">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M8 5v3M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span className="text-xs text-red-600">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-lg text-sm font-black uppercase tracking-widest text-white transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: loading ? '#6b7280' : 'linear-gradient(135deg, #2E3192 0%, #1a1d6e 100%)' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  'Sign In →'
                )}
              </button>
            </form>

          </div>
        </div>

      </div>
    </div>
  );
}
