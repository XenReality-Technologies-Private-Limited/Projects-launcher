import { useRef, useEffect, useState } from 'react';
import { TimeSeriesGraph } from '../lib/graph';

function formatIST(ms) {
  return new Date(ms).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function fmtDuration(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function CameraCard({
  channel,
  label,
  videoUrl,
  videoStartTime,
  timeSeries,
  forcedActiveIds = undefined, // when set, override timeSeries RE-ID (used by Ground Lobby to mirror CH25)
  clockStartTime = null,
  onPhaseChange = null,
  onMatchChange = null,        // called with active IDs array whenever RE-ID state changes (-5 card)
}) {
  const hasWait = Boolean(clockStartTime);
  const waitEndMs = hasWait ? new Date(videoStartTime).getTime() : 0;

  const [phase, setPhase] = useState(hasWait ? 'wait' : 'main');
  const [clockMs, setClockMs] = useState(hasWait ? new Date(clockStartTime).getTime() : 0);
  const [currentSec, setCurrentSec] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const graphRef = useRef(null);

  const counts = timeSeries.counts ?? [];
  const personIds = timeSeries.personIds ?? [];

  // ── Graph init ─────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    const yMax = Math.max(1, ...(counts.length ? counts : [1]));
    graphRef.current = new TimeSeriesGraph(canvasRef.current, {
      lineColor: '#10b981',
      yMax,
      isBinary: true,
      showLiveCount: false,
    });
    graphRef.current.setValues(counts);
    graphRef.current.setCurrentIndex(0);
    graphRef.current.render();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Graph update ───────────────────────────────────────────
  useEffect(() => {
    if (!graphRef.current) return;
    graphRef.current.setCurrentIndex(phase === 'main' ? currentSec : 0);
    graphRef.current.render();
  }, [currentSec, phase]);

  // ── Notify parent when phase changes ──────────────────────
  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Clock ticker (wait phase only) ─────────────────────────
  useEffect(() => {
    if (phase !== 'wait') return;
    const interval = setInterval(() => {
      setClockMs((prev) => {
        const next = prev + 1000;
        if (next >= waitEndMs) {
          clearInterval(interval);
          setPhase('main');
          return waitEndMs;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, waitEndMs]);

  // ── Auto-play video when main phase starts ─────────────────
  useEffect(() => {
    if (phase === 'main' && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [phase]);

  const clockStartMs = hasWait ? new Date(clockStartTime).getTime() : 0;
  const waitTotalSec = hasWait ? (waitEndMs - clockStartMs) / 1000 : 0;
  const waitElapsedSec = hasWait ? (clockMs - clockStartMs) / 1000 : 0;
  const waitPct = waitTotalSec > 0 ? Math.min(100, (waitElapsedSec / waitTotalSec) * 100) : 0;

  // Ground Lobby uses forcedActiveIds (mirrors CH25 exactly).
  // -5 card derives from its own timeSeries during main phase.
  const activeIds = forcedActiveIds !== undefined
    ? forcedActiveIds
    : (phase === 'main' ? (personIds[currentSec] ?? []) : []);

  // Notify parent (-5 card) whenever active IDs change
  useEffect(() => {
    onMatchChange?.(activeIds);
  }, [activeIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const isAwaiting = forcedActiveIds !== undefined
    ? forcedActiveIds.length === 0
    : phase === 'wait';

  const reIdSubLabel = activeIds.length > 0
    ? 'Cross-camera match on floor'
    : isAwaiting
      ? 'Tracking — awaiting cross-camera match'
      : 'No match in frame';

  return (
    <section className="kpi-card camera-card">
      <div className="kpi-header">
        <div className="kpi-title-wrap">
          <span className="kpi-title-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="15" rx="2" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              <circle cx="12" cy="14" r="2" />
            </svg>
          </span>
          <h2 className="kpi-title">{label}</h2>
        </div>
        <span className="kpi-badge">ACTIVE</span>
      </div>

      {/* Video / wait screen */}
      <div className="kpi-video-container">
        <span className="kpi-video-label">{channel.toUpperCase()}</span>

        {phase === 'wait' ? (
          <div className="camera-wait-screen">
            <div className="camera-wait-osd">
              24-04-2026 &nbsp;{formatIST(clockMs)}
            </div>
            <div className="camera-wait-status">Awaiting camera feed…</div>
            <div className="camera-wait-controls">
              <span className="wait-ctrl-btn" aria-label="playing">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              </span>
              <span className="wait-ctrl-time">
                {fmtDuration(waitElapsedSec)} / {fmtDuration(waitTotalSec)}
              </span>
              <div
                className="wait-ctrl-track"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  setClockMs(clockStartMs + pct * (waitEndMs - clockStartMs));
                }}
              >
                <div className="wait-ctrl-fill" style={{ width: `${waitPct}%` }} />
                <div className="wait-ctrl-thumb" style={{ left: `${waitPct}%` }} />
              </div>
              <span className="wait-ctrl-btn" aria-label="muted">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
              </span>
              <span className="wait-ctrl-btn" aria-label="fullscreen">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              </span>
            </div>
          </div>
        ) : hasWait ? (
          <video
            ref={videoRef}
            className="kpi-video"
            src={videoUrl}
            controls
            muted
            playsInline
            onTimeUpdate={(e) => setCurrentSec(Math.floor(e.target.currentTime))}
          />
        ) : (
          <video
            className="kpi-video"
            src={videoUrl}
            controls
            muted
            playsInline
            autoPlay
            onTimeUpdate={(e) => setCurrentSec(Math.floor(e.target.currentTime))}
          />
        )}
      </div>

      {/* Metrics */}
      <div className="camera-metrics">
        <div className="camera-count-block">
          <div className="kpi-metric-label">RE-ID MATCH</div>
          {activeIds.length > 0 ? (
            <div className="reid-ids">
              {activeIds.map((id) => (
                <span key={id} className="reid-id-badge">P#{id}</span>
              ))}
            </div>
          ) : (
            <div className="kpi-metric-value reid-absent">--</div>
          )}
          <div className="kpi-legend reid-sublabel">{reIdSubLabel}</div>
        </div>
        <div className="camera-graph-block">
          <canvas ref={canvasRef} className="kpi-graph" width={600} height={120} />
          <div className="kpi-legend">Re-ID match activity — last 60 s &nbsp;|&nbsp; green fill = person on floor</div>
        </div>
      </div>
    </section>
  );
}
