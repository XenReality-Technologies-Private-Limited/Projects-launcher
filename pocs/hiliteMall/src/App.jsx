import { useState, useEffect } from 'react';
import { initDatabase } from './lib/db';
import { buildTimeSeries } from './lib/timeSeries';
import { VIDEO_CONFIG } from './config';
import Header from './components/Header';
import CameraCard from './components/CameraCard';
import JourneyTable from './components/JourneyTable';
import StatsRow from './components/StatsRow';

export default function App() {
  const [dbData, setDbData] = useState(null);
  const [error, setError] = useState(null);
  const [ch25ActiveIds, setCh25ActiveIds] = useState([]);

  useEffect(() => {
    initDatabase()
      .then((data) => {
        const timeSeries = buildTimeSeries(data.floorVisits, VIDEO_CONFIG);
        setDbData({ ...data, timeSeries });
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="load-screen">
        <div className="load-error">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p>Failed to load database</p>
          <p className="load-error-detail">{error}</p>
        </div>
      </div>
    );
  }

  if (!dbData) {
    return (
      <div className="load-screen">
        <div className="load-spinner" />
        <p className="load-text">Loading database…</p>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div id="app">
        <main className="dashboard-main">
          <div className="camera-grid">
            {Object.entries(VIDEO_CONFIG).map(([channel, cfg]) => (
              <CameraCard
                key={channel}
                channel={channel}
                label={cfg.label}
                videoUrl={cfg.url}
                videoStartTime={cfg.startTime}
                timeSeries={dbData.timeSeries[channel] || { counts: [], personIds: [] }}
                // Ground Lobby: mirror exactly what CH25 is showing
                forcedActiveIds={cfg.suppressReId ? ch25ActiveIds : undefined}
                clockStartTime={cfg.clockStartTime ?? null}
                onPhaseChange={cfg.clockStartTime
                  ? (phase) => { if (phase === 'wait') setCh25ActiveIds([]); }
                  : undefined}
                onMatchChange={cfg.clockStartTime ? setCh25ActiveIds : undefined}
              />
            ))}
          </div>
          <JourneyTable transitions={dbData.transitions} />
          <StatsRow persons={dbData.persons} floorVisits={dbData.floorVisits} />
        </main>
      </div>
    </>
  );
}
