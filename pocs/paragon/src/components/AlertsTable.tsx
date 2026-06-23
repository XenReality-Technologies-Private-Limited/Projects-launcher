import { useState } from 'react';
import type { ClearanceAlert } from '../api';

const IST_OFFSET = 19800;

function formatIst(unixtime: number): string {
  const d = new Date((unixtime + IST_OFFSET) * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function eventSnapshotUrl(tableId: string, unixtime: number): string {
  return `/kpis/snapshots/${tableId}_unclean_${unixtime}.jpg?t=${Date.now()}`;
}

function latestSnapshotUrl(tableId: string): string {
  return `/kpis/snapshots/${tableId}_unclean.jpg?t=${Date.now()}`;
}

export default function AlertsTable({ alerts }: { alerts: ClearanceAlert[] }) {
  const [snap, setSnap] = useState<{ tableId: string; unixtime: number; label: string } | null>(null);

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {alerts.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">No alerts in selected period</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-[2px] text-slate-400">Timestamp</th>
                  <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-[2px] text-slate-400">Table</th>
                  <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-[2px] text-slate-400">Status</th>
                  <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-[2px] text-slate-400">Unclean For</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {alerts.map((alert, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-slate-600 tabular-nums">{formatIst(alert.unixtime)}</td>
                    <td className="px-5 py-3 font-semibold text-slate-700">{alert.tableLabel.toUpperCase()}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wide"
                          style={{ background: '#FEF3C7', color: '#92400E' }}
                        >
                          UNCLEAN
                        </span>
                        <button
                          onClick={() => setSnap({ tableId: alert.tableId, unixtime: alert.unixtime, label: alert.tableLabel })}
                          title="View snapshot"
                          className="text-slate-400 hover:text-[#2E3192] transition-colors"
                        >
                          <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
                            <path d="M10 4C5.5 4 2 10 2 10s3.5 6 8 6 8-6 8-6-3.5-6-8-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                            <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-semibold" style={{ color: '#92400E' }}>
                      &gt; 1 min
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Snapshot modal */}
      {snap && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setSnap(null)}
        >
          <div
            className="bg-white rounded-xl p-4 shadow-2xl mx-4"
            style={{ maxWidth: 560, width: '100%' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-slate-800 text-sm">{snap.label} — Last Unclean Snapshot</span>
              <button
                onClick={() => setSnap(null)}
                className="text-slate-400 hover:text-slate-700 text-xl leading-none font-light"
              >
                ×
              </button>
            </div>
            <img
              key={`${snap.tableId}-${snap.unixtime}`}
              src={eventSnapshotUrl(snap.tableId, snap.unixtime)}
              alt={`${snap.label} unclean snapshot`}
              className="w-full rounded-lg object-contain"
              style={{ maxHeight: 400 }}
              onError={e => {
                const img = e.target as HTMLImageElement;
                if (!img.getAttribute('data-fallback')) {
                  img.setAttribute('data-fallback', '1');
                  img.src = latestSnapshotUrl(snap.tableId);
                } else {
                  img.alt = 'Snapshot not available';
                  img.style.padding = '2rem';
                  img.style.background = '#f8fafc';
                  img.style.color = '#94a3b8';
                }
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
