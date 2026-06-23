import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { motion } from 'motion/react';
import { Filter } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const funnelData = [
  { name: 'Passer By', value: 1500000, percentage: '100.0%', color: '#DE2F2F' },
  { name: 'Footfall', value: 455800, percentage: '31.4%', color: '#3B82F6' },
  { name: 'Greeted', value: 339200, percentage: '23.4%', color: '#10B981' },
  { name: 'Unattended', value: 165000, percentage: '11.4%', color: '#F59E0B' },
  { name: 'Trials', value: 131300, percentage: '9.1%', color: '#EC4899' },
];

const trendData = [
  { date: '2026-05-10', passerBy: 410000 },
  { date: '2026-05-11', passerBy: 210000 },
  { date: '2026-05-12', passerBy: 205000 },
  { date: '2026-05-13', passerBy: 206000 },
  { date: '2026-05-14', passerBy: 215000 },
  { date: '2026-05-15', passerBy: 208000 },
  { date: '2026-05-16', passerBy: 15000 },
];

export default function RetailFunnelChart() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  const axisColor = isDark ? "#475569" : "#94a3b8";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Trend Chart */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card-premium"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="heading-section">Trend Analysis</h3>
          <select className="bg-black/[0.05] dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] outline-none">
            <option>Passer By</option>
            <option>Footfall</option>
          </select>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#DE2F2F" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#DE2F2F" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke={axisColor} 
                fontSize={9} 
                tickMargin={10}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                stroke={axisColor} 
                fontSize={9} 
                tickFormatter={(val) => `${val / 1000}K`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: isDark ? '#020617' : '#FFFFFF',
                  borderRadius: '12px',
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                  fontSize: '11px',
                  fontWeight: 'bold'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="passerBy" 
                stroke="#DE2F2F" 
                strokeWidth={2}
                fill="url(#colorTrend)"
                dot={{ r: 4, fill: '#FFFFFF', stroke: '#DE2F2F', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#DE2F2F' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Sales Funnel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="card-premium"
      >
        <h3 className="heading-section mb-6">Sales Funnel</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnelData} layout="vertical" barGap={10}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={true} horizontal={false} />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                stroke={axisColor} 
                fontSize={11} 
                fontWeight={600}
                axisLine={false}
                tickLine={false}
                width={100}
              />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                content={({ active, payload }: any) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] p-3 rounded-lg shadow-xl">
                        <p className="text-xs font-bold text-[var(--text-primary)]">{data.name}</p>
                        <p className="text-lg font-black text-brand-secondary">{new Intl.NumberFormat().format(data.value)}</p>
                        <p className="text-[10px] text-[var(--text-muted)] font-bold">{data.percentage} of total</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                {funnelData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Custom Labels Overlay (since Recharts horizontal bar labels can be tricky to align exactly like the reference) */}
          <div className="absolute top-[6.5rem] right-10 space-y-[2.1rem] pointer-events-none">
             {funnelData.map((entry) => (
               <div key={entry.name} className="flex items-center gap-2 text-[11px] font-bold">
                 <span className="text-[var(--text-primary)]">{(entry.value / 1000000).toFixed(1)}M</span>
                 <span className="text-[var(--text-muted)] italic">({entry.percentage})</span>
               </div>
             ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
