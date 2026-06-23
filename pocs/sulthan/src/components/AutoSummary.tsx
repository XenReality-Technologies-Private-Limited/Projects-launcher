import { motion } from 'motion/react';
import { Sparkles, ArrowRight } from 'lucide-react';

export default function AutoSummary() {
  const insights = [
    { text: 'Footfall is down 15.7% vs prior period (455,816 visitors).', id: '1' },
    { text: 'Trial rate is 28.8% (down 0.7% vs prior period).', id: '2' },
    { text: 'Greeted 339,153 customers (74.4% greeting rate, up 0.1% vs prior period).', id: '3' },
    { text: 'Unattended customers: 164,984 (down 16.1% vs prior period).', id: '4' },
    { text: 'Dwell time breakdown — under 2 min: 73,283, 2-10 min: 110,901, over 10 min: 180,982.', id: '5' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-premium border-amber-500/30 bg-amber-500/5 overflow-hidden group"
    >
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="size-4 text-amber-600 animate-pulse" />
        <h3 className="text-amber-700 dark:text-amber-500 text-[11px] font-black uppercase tracking-[3px]">Auto Summary</h3>
      </div>
      
      <div className="space-y-4">
        {insights.map((insight, idx) => (
          <motion.div
            key={insight.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + idx * 0.05 }}
            className="flex items-start gap-4 group/item"
          >
            <div className="mt-[6px] size-1.5 rounded-full bg-amber-600/30 group-hover/item:bg-amber-600 transition-colors" />
            <p className="text-[13px] font-medium text-[var(--text-secondary)] group-hover/item:text-[var(--text-primary)] transition-colors leading-relaxed">
              {insight.text}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t border-amber-500/10 flex justify-end">
        <button className="flex items-center gap-2 text-[10px] font-bold text-amber-700 dark:text-amber-500 uppercase tracking-widest hover:translate-x-1 transition-transform">
          Full Context Report
          <ArrowRight className="size-3" />
        </button>
      </div>
    </motion.div>
  );
}
