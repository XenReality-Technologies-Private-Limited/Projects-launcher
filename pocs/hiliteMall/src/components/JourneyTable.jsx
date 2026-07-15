import { useState } from 'react';
import { CHANNEL_LABELS, TRANSITION_SCREENSHOTS } from '../config';

function fmtTime(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function fmtTravel(seconds) {
  if (seconds == null) return '--';
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function JourneyTable({ transitions }) {
  const [modal, setModal] = useState(null); // { src, title }

  return (
    <>
      <section className="kpi-card journey-card">
        <div className="kpi-header">
          <div className="kpi-title-wrap">
            <span className="kpi-title-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M13 6l6 6-6 6" />
              </svg>
            </span>
            <h2 className="kpi-title">PERSON JOURNEYS</h2>
          </div>
          <span className="kpi-badge journey-count">{transitions.length} TRACKED</span>
        </div>

        {transitions.length === 0 ? (
          <p className="journey-empty">No cross-floor journeys detected.</p>
        ) : (
          <div className="journey-table-wrap">
            <table className="journey-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Departed</th>
                  <th>Arrived</th>
                  <th>Travel Time</th>
                </tr>
              </thead>
              <tbody>
                {transitions.map((t) => {
                  const shots = TRANSITION_SCREENSHOTS[`${t.canonical_id}_${t.from_channel}`];
                  return (
                    <tr key={t.id}>
                      <td className="journey-person-id">P#{t.canonical_id}</td>
                      <td>{CHANNEL_LABELS[t.from_channel] ?? t.from_channel}</td>
                      <td>{CHANNEL_LABELS[t.to_channel] ?? t.to_channel}</td>
                      <td className="journey-time">
                        {fmtTime(t.exit_time)}
                        {shots?.departed && (
                          <button
                            className="eye-btn"
                            title="View snapshot"
                            onClick={() => setModal({
                              src: shots.departed,
                              title: `P#${t.canonical_id} — ${CHANNEL_LABELS[t.from_channel]} · ${fmtTime(t.exit_time)}`,
                            })}
                          >
                            <EyeIcon />
                          </button>
                        )}
                      </td>
                      <td className="journey-time">
                        {fmtTime(t.entry_time)}
                        {shots?.arrived && (
                          <button
                            className="eye-btn"
                            title="View snapshot"
                            onClick={() => setModal({
                              src: shots.arrived,
                              title: `P#${t.canonical_id} — ${CHANNEL_LABELS[t.to_channel]} · ${fmtTime(t.entry_time)}`,
                            })}
                          >
                            <EyeIcon />
                          </button>
                        )}
                      </td>
                      <td className="journey-travel">{fmtTravel(t.travel_seconds)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal && (
        <div className="snapshot-backdrop" onClick={() => setModal(null)}>
          <div className="snapshot-modal" onClick={(e) => e.stopPropagation()}>
            <div className="snapshot-header">
              <span className="snapshot-title">{modal.title}</span>
              <button className="snapshot-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <img className="snapshot-img" src={modal.src} alt={modal.title} />
          </div>
        </div>
      )}
    </>
  );
}
