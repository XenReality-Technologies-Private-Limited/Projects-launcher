function fmtDuration(seconds) {
  if (seconds == null || isNaN(seconds)) return '--';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function totalDwell(floorVisits, channel) {
  const visits = floorVisits.filter((v) => v.channel === channel);
  if (!visits.length) return null;
  return visits.reduce((sum, v) => sum + v.duration_seconds, 0);
}

export default function StatsRow({ persons, floorVisits }) {
  const crossFloor = persons.filter((p) => p.floors_visited > 1).length;
  const dwellCh20 = totalDwell(floorVisits, 'ch20');
  const dwellCh25 = totalDwell(floorVisits, 'ch25');

  return (
    <div className="stats-row">
      <div className="stat-card">
        <div className="stat-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <div className="stat-label">CROSS-FLOOR PERSONS</div>
        <div className="stat-value">{crossFloor}</div>
      </div>

      <div className="stat-card">
        <div className="stat-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div className="stat-label">TOTAL DWELL — GROUND LOBBY</div>
        <div className="stat-value">{fmtDuration(dwellCh20)}</div>
      </div>

      <div className="stat-card">
        <div className="stat-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div className="stat-label">TOTAL DWELL — -5</div>
        <div className="stat-value">{fmtDuration(dwellCh25)}</div>
      </div>
    </div>
  );
}
