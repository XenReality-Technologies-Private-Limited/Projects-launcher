import { Bell, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';

const alerts = [
  { id: 1, type: 'incident', title: 'Restricted Area Entry', time: '2m ago', desc: 'Movement detected in Warehouse B outside operating hours.', severity: 'high' },
  { id: 2, type: 'insight', title: 'Queue Build-up', time: '14m ago', desc: 'Main checkout lane exceeding 10 persons.', severity: 'medium' },
  { id: 3, type: 'system', title: 'Calibration Complete', time: '1h ago', desc: 'Vision AI model updated for Store #12.', severity: 'low' },
  { id: 4, type: 'incident', title: 'Unattended Item', time: '2h ago', desc: 'Item left unattended detected at Entrance 3.', severity: 'high' },
];

export default function AlertsPanel() {
  return (
    <div className="card-premium h-full flex flex-col border-brand-primary/10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="eyebrow !mb-0">Alerts & Incidents</div>
          <h3 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Recent Activity</h3>
        </div>
        <button className="text-brand-secondary text-[10px] font-black uppercase tracking-widest hover:text-[var(--text-primary)] transition-colors cursor-pointer">Clear</button>
      </div>

      <div className="space-y-5 flex-1">
        {alerts.map((alert) => (
          <div key={alert.id} className="group flex gap-4 p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all duration-300">
            <div className={`mt-0.5 p-2.5 rounded-xl shrink-0 shadow-lg ${
              alert.severity === 'high' ? 'bg-red-500/10 text-red-600 dark:text-red-400 group-hover:bg-red-500/20' :
              alert.severity === 'medium' ? 'bg-brand-tertiary/10 text-brand-tertiary group-hover:bg-brand-tertiary/20' :
              'bg-brand-quaternary/10 text-brand-quaternary group-hover:bg-brand-quaternary/20'
            }`}>
              {alert.severity === 'high' ? <AlertTriangle className="size-4" /> : 
               alert.severity === 'medium' ? <Info className="size-4" /> : 
               <CheckCircle2 className="size-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-1.5">
                <h4 className="text-[13px] font-bold text-[var(--text-primary)] truncate pr-2 tracking-tight">{alert.title}</h4>
                <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase whitespace-nowrap bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded italic">{alert.time}</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed opacity-80 line-clamp-2">{alert.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button className="w-full mt-10 py-3.5 bg-black/[0.02] dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-[10px] font-black text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/[0.05] dark:hover:bg-white/10 transition-all uppercase tracking-[2px] shadow-sm">
        Full Event Audit Log
      </button>
    </div>
  );
}
