import { useEffect, useState, useRef } from 'react';
import initSqlJs from 'sql.js';
import './App.css';

const CF = 'https://d2uimaqek2eby3.cloudfront.net/Safeer';

const CAMS = [
  { id: 1, label: 'Camera 1', video: `${CF}/merged_1.mp4`, db: `${CF}/events.db` },
  { id: 2, label: 'Camera 2', video: `${CF}/merged_2.mp4`, db: `${CF}/events_2.db` },
];

function calcStats(events) {
  const total = events.length;
  const scanned = events.filter(e => e.scanned === 1).length;
  return { total, scanned, unscanned: total - scanned, rate: total ? Math.round((scanned / total) * 100) : 0 };
}

// ── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }) {
  return (
    <div className="kpi-card" style={{ borderTopColor: accent }}>
      <div className="kpi-value" style={{ color: accent }}>{value}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

// ── Event Timeline ────────────────────────────────────────────────────────────

function EventTimeline({ events, duration, currentTime, onSeek }) {
  const [hovered, setHovered] = useState(null);

  return (
    <div className="timeline-wrap">
      <div
        className="timeline-bar"
        onClick={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          onSeek(((e.clientX - rect.left) / rect.width) * (duration || 1));
        }}
      >
        {duration > 0 && (
          <div className="timeline-cursor" style={{ left: `${(currentTime / duration) * 100}%` }} />
        )}
        {events.map((ev, i) => (
          <div
            key={i}
            className={`timeline-dot ${ev.scanned ? 'dot-green' : 'dot-red'}`}
            style={{ left: duration > 0 ? `${(ev.time_seconds / duration) * 100}%` : '0' }}
            onClick={e => { e.stopPropagation(); onSeek(ev.time_seconds); }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            {hovered === i && (
              <div className="timeline-tooltip">
                {ev.time} · {ev.scanned ? '✓ Scanned' : '✗ Not Scanned'}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="timeline-labels">
        <span>0:00</span>
        {duration > 0 && (
          <span>{String(Math.floor(duration / 60)).padStart(2,'0')}:{String(Math.round(duration % 60)).padStart(2,'0')}</span>
        )}
      </div>
    </div>
  );
}

// ── Events Table ──────────────────────────────────────────────────────────────

function EventsTable({ events, currentTime, onSeek }) {
  const activeIdx = events.reduce((best, ev, i) => (ev.time_seconds <= currentTime ? i : best), -1);

  return (
    <div className="events-table-wrap">
      <table className="events-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Time</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev, i) => (
            <tr
              key={i}
              className={[i === activeIdx ? 'row-active' : '', !ev.scanned ? 'row-alert' : ''].join(' ')}
              onClick={() => onSeek(ev.time_seconds)}
            >
              <td className="row-num">{i + 1}</td>
              <td className="time-cell">{ev.time}</td>
              <td>
                {ev.scanned
                  ? <span className="badge badge-green">✓ Scanned</span>
                  : <span className="badge badge-red">✗ Not Scanned</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Camera View ───────────────────────────────────────────────────────────────

function CameraView({ cam, data }) {
  const videoRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const { events, stats } = data;

  const seek = secs => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = secs;
    videoRef.current.play().catch(() => {});
  };

  return (
    <div className="cam-view">
      <div className="video-wrap">
        <video
          ref={videoRef}
          className="video-player"
          controls
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        >
          <source src={cam.video} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>

      <div className="kpi-row">
        <KpiCard label="Total Items" value={stats.total} accent="#3b82f6" />
        <KpiCard label="Scanned" value={stats.scanned} accent="#10b981" sub="correctly processed" />
        <KpiCard
          label="Not Scanned"
          value={stats.unscanned}
          accent={stats.unscanned > 0 ? '#ef4444' : '#10b981'}
          sub={stats.unscanned > 0 ? '⚠ suspicious' : 'none detected'}
        />
        <KpiCard
          label="Compliance"
          value={`${stats.rate}%`}
          accent={stats.rate >= 90 ? '#10b981' : '#f59e0b'}
          sub="scan rate"
        />
      </div>

      <div className="section">
        <div className="section-title">
          Event Timeline
          <span className="legend">
            <span className="legend-dot dot-green" /> Scanned
            <span className="legend-dot dot-red" /> Not Scanned
          </span>
        </div>
        <EventTimeline events={events} duration={duration} currentTime={currentTime} onSeek={seek} />
        <p className="timeline-hint">Click any dot to jump to that moment in the video</p>
      </div>

      <div className="section">
        <div className="section-title">
          Events
          <span className="badge-count">{stats.total} total</span>
          {stats.unscanned > 0 && (
            <span className="badge-count badge-count-red">{stats.unscanned} suspicious</span>
          )}
        </div>
        <EventsTable events={events} currentTime={currentTime} onSeek={seek} />
      </div>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

function Overview({ camData, onTabChange }) {
  const allEvents = [...(camData[0]?.events || []), ...(camData[1]?.events || [])];
  const stats = calcStats(allEvents);
  const suspicious = [
    ...(camData[0]?.events.filter(e => !e.scanned).map(e => ({ ...e, cam: 1 })) || []),
    ...(camData[1]?.events.filter(e => !e.scanned).map(e => ({ ...e, cam: 2 })) || []),
  ].sort((a, b) => a.time_seconds - b.time_seconds);

  return (
    <div className="overview">
      {stats.unscanned > 0 && (
        <div className="alert-banner">
          ⚠&nbsp; {stats.unscanned} item{stats.unscanned !== 1 ? 's' : ''} left without scanning across both cameras
        </div>
      )}

      <div className="kpi-row">
        <KpiCard label="Total Items" value={stats.total} accent="#3b82f6" sub="both cameras" />
        <KpiCard label="Scanned" value={stats.scanned} accent="#10b981" sub="correctly processed" />
        <KpiCard
          label="Not Scanned"
          value={stats.unscanned}
          accent={stats.unscanned > 0 ? '#ef4444' : '#10b981'}
          sub={stats.unscanned > 0 ? '⚠ suspicious' : 'none detected'}
        />
        <KpiCard
          label="Compliance"
          value={`${stats.rate}%`}
          accent={stats.rate >= 90 ? '#10b981' : '#f59e0b'}
          sub="scan rate"
        />
      </div>

      <div className="cam-summary-row">
        {CAMS.map((cam, i) => {
          const s = camData[i]?.stats;
          if (!s) return null;
          return (
            <div key={cam.id} className="cam-summary-card" onClick={() => onTabChange(String(cam.id))}>
              <div className="cam-summary-header">
                <div className="cam-summary-title">{cam.label}</div>
                {s.unscanned > 0 && <span className="cam-alert-chip">⚠ {s.unscanned} suspicious</span>}
              </div>
              <div className="cam-rate-bar">
                <div className="cam-rate-fill" style={{ width: `${s.rate}%`, background: s.rate >= 90 ? '#10b981' : '#f59e0b' }} />
              </div>
              <div className="cam-summary-stats">
                <span>{s.scanned} scanned · {s.unscanned} not scanned · {s.rate}% compliance</span>
              </div>
              <div className="cam-summary-link">View camera details →</div>
            </div>
          );
        })}
      </div>

      {suspicious.length > 0 && (
        <div className="section">
          <div className="section-title suspicious-title">⚠ Suspicious Items — Not Scanned</div>
          <div className="suspicious-list">
            {suspicious.map((ev, i) => (
              <div key={i} className="suspicious-item" onClick={() => onTabChange(String(ev.cam))}>
                <span className="sus-cam">Camera {ev.cam}</span>
                <span className="sus-time">{ev.time}</span>
                <span className="badge badge-red">✗ Not Scanned</span>
                <span className="sus-link">Review in camera →</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Loading / Error ───────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="center-screen">
      <div className="spinner" />
      <p>Loading dashboard data…</p>
    </div>
  );
}

function ErrorScreen({ msg }) {
  return (
    <div className="center-screen">
      <p style={{ color: '#ef4444' }}>Failed to load: {msg}</p>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState('overview');
  const [camData, setCamData] = useState([null, null]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const SQL = await initSqlJs({
        locateFile: f => `https://cdn.jsdelivr.net/npm/sql.js@1.14.0/dist/${f}`,
      });
      const results = await Promise.all(
        CAMS.map(async cam => {
          const res = await fetch(cam.db);
          const buf = await res.arrayBuffer();
          const db  = new SQL.Database(new Uint8Array(buf));
          const rows = db.exec('SELECT time, time_seconds, scanned FROM events ORDER BY time_seconds')[0];
          db.close();
          if (!rows) return { events: [], stats: calcStats([]) };
          const events = rows.values.map(([time, time_seconds, scanned]) => ({ time, time_seconds, scanned }));
          return { events, stats: calcStats(events) };
        })
      );
      setCamData(results);
      setLoading(false);
    })().catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <LoadingScreen />;
  if (error)   return <ErrorScreen msg={error} />;

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <div className="header-logo-box">SG</div>
          <div>
            <div className="header-name">Safeer Group</div>
            <div className="header-sub">Self-Checkout Monitor</div>
          </div>
        </div>
        <nav className="tab-nav">
          {[['overview', 'Overview'], ['1', 'Camera 1'], ['2', 'Camera 2']].map(([key, label]) => (
            <button
              key={key}
              className={`tab-btn${tab === key ? ' active' : ''}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="main-content">
        {tab === 'overview' && <Overview camData={camData} onTabChange={setTab} />}
        {tab === '1'        && <CameraView cam={CAMS[0]} data={camData[0]} />}
        {tab === '2'        && <CameraView cam={CAMS[1]} data={camData[1]} />}
      </main>
    </div>
  );
}
