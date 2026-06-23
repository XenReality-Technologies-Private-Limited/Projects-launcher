import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Eye, 
  Clock, 
  ShoppingBag 
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

const stats = [
  {
    label: 'Total Footfall',
    value: '455,816',
    change: '-15.7%',
    isPositive: false,
    icon: Users,
  },
  {
    label: 'Passer By',
    value: '1.5M',
    change: '+3.2%',
    isPositive: true,
    icon: Eye,
  },
  {
    label: 'Trial Rate',
    value: '28.8%',
    change: '-0.7%',
    isPositive: false,
    icon: ShoppingBag,
  },
  {
    label: 'Greeting Rate',
    value: '74.4%',
    change: '+0.1%',
    isPositive: true,
    icon: Eye,
  },
];

export default function KPISection() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, idx) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          transition={{ delay: idx * 0.1 }}
          className="card-premium group relative border-white/10 hover:border-brand-blue-light/50 transition-all duration-300 overflow-hidden"
        >
          {/* Subtle Background Glow on Hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-blue-light/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 rounded-xr-xl bg-black/5 dark:bg-white/5 text-brand-secondary group-hover:bg-brand-tertiary group-hover:text-white group-hover:shadow-[0_0_15px_rgba(245,130,32,0.4)] group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                <stat.icon className="size-5" />
              </div>
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border border-black/5 dark:border-white/5",
                stat.isPositive ? 'bg-brand-quaternary/10 text-brand-quaternary' : 'bg-red-500/10 text-red-500'
              )}>
                {stat.change === 'Live' ? (
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-brand-quaternary animate-ping" />
                    Live
                  </span>
                ) : (
                  <>
                    {stat.isPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                    {stat.change}
                  </>
                )}
              </div>
            </div>
            
            <h3 className="text-[var(--text-muted)] text-[11px] font-bold uppercase tracking-[2.5px] mb-2">{stat.label}</h3>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-[var(--text-primary)] tracking-tighter">{stat.value}</p>
              {stat.isPositive && stat.change !== 'Live' && (
                <span className="text-brand-quaternary/80 text-xs font-bold font-mono">↑</span>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
