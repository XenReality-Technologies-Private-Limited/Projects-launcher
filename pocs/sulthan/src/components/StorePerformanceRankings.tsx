import { motion } from 'motion/react';
import { Trophy, AlertTriangle, TrendingUp } from 'lucide-react';

const topStores = [
  { rank: 1, name: 'BATA-7693', value: '17.5K' },
  { rank: 2, name: 'BATA-1015', value: '11.8K' },
  { rank: 3, name: 'BATA-7580', value: '11.7K' },
  { rank: 4, name: 'BATA-1014', value: '10.8K' },
  { rank: 5, name: 'BATA-0506', value: '10.8K' },
];

const bottomStores = [
  { rank: 1, name: 'BATA-2775', value: '0' },
  { rank: 2, name: 'BATA-2249', value: '0' },
  { rank: 3, name: 'BATA-2572', value: '9' },
  { rank: 4, name: 'BATA-1133', value: '52' },
  { rank: 5, name: 'BATA-1676', value: '167' },
];

const improvedStores = [
  { rank: 1, name: 'BATA-9473', value: '3.0K', change: '+478.4%' },
  { rank: 2, name: 'BATA-3256', value: '6.7K', change: '+359.5%' },
  { rank: 3, name: 'BATA-520', value: '5.2K', change: '+283.1%' },
  { rank: 4, name: 'BATA-1114', value: '495', change: '+269.4%' },
  { rank: 5, name: 'BATA-3321', value: '5.9K', change: '+258.9%' },
];

export default function StorePerformanceRankings() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Top 5 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-premium h-fit"
      >
        <div className="flex items-center gap-2 mb-6">
          <Trophy className="size-4 text-brand-secondary" />
          <h3 className="text-[13px] font-bold text-[var(--text-primary)] uppercase tracking-wider">Top 5 Stores</h3>
        </div>
        <div className="space-y-4">
          {topStores.map((store) => (
            <div key={store.name} className="flex items-center justify-between group pt-4 border-t border-[var(--border-subtle)] first:pt-0 first:border-0">
              <div className="flex items-center gap-3">
                <span className="size-6 rounded-full bg-brand-secondary/10 text-brand-secondary text-[11px] font-bold flex items-center justify-center">
                  {store.rank}
                </span>
                <span className="text-sm font-bold text-[var(--text-secondary)] group-hover:text-brand-secondary transition-colors truncate">
                  {store.name}
                </span>
              </div>
              <span className="font-mono text-sm font-bold text-[var(--text-primary)]">{store.value}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Bottom 5 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card-premium h-fit"
      >
        <div className="flex items-center gap-2 mb-6">
          <AlertTriangle className="size-4 text-red-500" />
          <h3 className="text-[13px] font-bold text-[var(--text-primary)] uppercase tracking-wider">Bottom 5 Stores</h3>
        </div>
        <div className="space-y-4">
          {bottomStores.map((store) => (
            <div key={store.name} className="flex items-center justify-between group pt-4 border-t border-[var(--border-subtle)] first:pt-0 first:border-0">
              <div className="flex items-center gap-3">
                <span className="size-6 rounded-full bg-red-500/10 text-red-500 text-[11px] font-bold flex items-center justify-center">
                  {store.rank}
                </span>
                <span className="text-sm font-bold text-[var(--text-secondary)] group-hover:text-red-500 transition-colors truncate">
                  {store.name}
                </span>
              </div>
              <span className="font-mono text-sm font-bold text-[var(--text-primary)]">{store.value}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Most Improved */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card-premium h-fit"
      >
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="size-4 text-emerald-500" />
          <h3 className="text-[13px] font-bold text-[var(--text-primary)] uppercase tracking-wider">Most Improved</h3>
        </div>
        <div className="space-y-4">
          {improvedStores.map((store) => (
            <div key={store.name} className="flex items-center justify-between group pt-4 border-t border-[var(--border-subtle)] first:pt-0 first:border-0">
              <div className="flex items-center gap-3">
                <span className="size-6 rounded-full bg-emerald-500/10 text-emerald-500 text-[11px] font-bold flex items-center justify-center">
                  {store.rank}
                </span>
                <span className="text-sm font-bold text-[var(--text-secondary)] group-hover:text-emerald-500 transition-colors truncate">
                  {store.name}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-mono text-sm font-bold text-[var(--text-primary)]">{store.value}</span>
                <span className="text-[10px] font-black text-emerald-500">{store.change}</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
