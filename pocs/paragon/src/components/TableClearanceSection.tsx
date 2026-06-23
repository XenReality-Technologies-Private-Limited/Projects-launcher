import type { ClearanceState, ClearanceTableState } from '../api';

function getState(s: ClearanceState | null): 'CLEAN' | 'OCCUPIED' | 'UNCLEAN' {
  if (!s) return 'CLEAN';
  if (s.isOccupied) return 'OCCUPIED';
  return s.isClean ? 'CLEAN' : 'UNCLEAN';
}

function stateStyle(state: 'CLEAN' | 'OCCUPIED' | 'UNCLEAN'): { border: string; color: string; bg: string } {
  switch (state) {
    case 'CLEAN':    return { border: '#00A651', color: '#00A651', bg: '#00A65112' };
    case 'UNCLEAN':  return { border: '#F58220', color: '#F58220', bg: '#F5822012' };
    case 'OCCUPIED': return { border: '#cbd5e1', color: '#64748b', bg: '#f8fafc' };
  }
}

export default function TableClearanceSection({ states }: { states: ClearanceTableState[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {states.map(s => {
        const cardState = getState(s);
        const { border, color, bg } = stateStyle(cardState);
        return (
          <div key={s.tableLabel} className="min-w-[10rem] rounded-xl shadow-sm p-4" style={{ border: `1.5px solid ${border}`, background: bg }}>
            <p className="text-[9px] font-black uppercase tracking-[2px] text-slate-500 mb-1 leading-tight">{s.tableLabel.toUpperCase()}</p>
            <p className="text-lg font-black leading-none" style={{ color }}>{cardState}</p>
          </div>
        );
      })}
    </div>
  );
}
