import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { motion } from 'motion/react';
import { MousePointer2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const visitorData = [
  { name: '08:00', visitors: 120 },
  { name: '10:00', visitors: 450 },
  { name: '12:00', visitors: 820 },
  { name: '14:00', visitors: 690 },
  { name: '16:00', visitors: 580 },
  { name: '18:00', visitors: 940 },
  { name: '20:00', visitors: 320 },
];

const conversionData = [
  { name: 'Electronics', value: 45, color: '#3B82F6' },
  { name: 'Fashion', value: 65, color: '#00AEEF' },
  { name: 'Grocery', value: 85, color: '#F58220' },
  { name: 'Beauty', value: 35, color: '#2E3192' },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 dark:bg-brand-navy/90 backdrop-blur-xl border border-black/10 dark:border-white/10 p-4 rounded-xr-xl shadow-xr-2xl">
        <p className="eyebrow mb-1">{label}</p>
        <p className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
          {new Intl.NumberFormat().format(payload[0].value as number)}
          <span className="text-[10px] text-brand-quaternary font-bold uppercase">Tracks</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function AnalyticsCharts() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  const axisColor = isDark ? "#475569" : "#94a3b8";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="lg:col-span-2 card-premium relative overflow-hidden group shadow-inner"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-10 relative z-10">
          <div>
            <div className="eyebrow mb-1">Store Footfall</div>
            <h3 className="heading-section">Visitor Activity</h3>
            <p className="text-[var(--text-secondary)] text-sm mt-1 max-w-sm">Aggregated sensor data across all designated entry zones.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-quaternary/5 text-brand-quaternary text-[10px] font-bold uppercase tracking-widest border border-brand-quaternary/10 backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-brand-quaternary animate-pulse" />
              Real-time
            </span>
            <select className="bg-black/[0.05] dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] focus:ring-2 focus:ring-brand-secondary/20 focus:border-brand-secondary/40 outline-none hover:border-black/20 dark:hover:border-white/20 transition-all cursor-pointer backdrop-blur-md">
              <option>Live: 24 Hours</option>
              <option>Historic: 7 Days</option>
            </select>
          </div>
        </div>

        <div className="h-[340px] w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={visitorData}>
              <defs>
                <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00AEEF" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00AEEF" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke={gridColor} vertical={false} />
              <XAxis 
                dataKey="name" 
                stroke={axisColor} 
                fontSize={10} 
                fontWeight={800}
                tickLine={false} 
                axisLine={false} 
                dy={15}
              />
              <YAxis 
                stroke={axisColor} 
                fontSize={10} 
                fontWeight={800} 
                tickLine={false} 
                axisLine={false} 
                dx={-15}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#00AEEF', strokeWidth: 1.5, strokeDasharray: '6 6' }} />
              <Area 
                type="monotone" 
                dataKey="visitors" 
                stroke="#00AEEF" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorVisitors)"
                animationDuration={2500}
                strokeLinecap="round"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="card-premium relative overflow-hidden flex flex-col"
      >
        <div className="eyebrow mb-1">Intelligence</div>
        <h3 className="heading-section">Zone Efficiency</h3>
        <p className="text-[var(--text-secondary)] text-sm mt-1 mb-8">Visitor conversion by product zone.</p>
        
        <div className="flex-1 min-h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={conversionData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={true} vertical={false} />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                stroke={axisColor} 
                fontSize={11} 
                fontWeight={600}
                tickLine={false} 
                axisLine={false}
                width={85}
              />
              <Tooltip 
                 cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
                 contentStyle={{ 
                  backgroundColor: isDark ? '#02154d' : '#ffffff', 
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  color: isDark ? '#ffffff' : '#0f172a'
                }}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24} animationDuration={1500}>
                {conversionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6 pt-6 border-t border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Average Rate</span>
            <span className="text-lg font-bold text-[var(--text-primary)]">14.2%</span>
          </div>
          <button className="flex items-center gap-2 text-brand-blue-link hover:text-brand-secondary transition-colors text-xs font-bold uppercase tracking-wider">
            Details
            <MousePointer2 className="size-3" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
