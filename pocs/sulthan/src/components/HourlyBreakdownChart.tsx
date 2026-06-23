import { 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';
import { motion } from 'motion/react';
import { useTheme } from '../context/ThemeContext';

const hourlyData = [
  { time: '9:00', footfall: 0, passerBy: 1000, greeted: 76, trialRate: 20, unattended: 28 },
  { time: '10:00', footfall: 14000, passerBy: 45000, greeted: 75, trialRate: 25, unattended: 32 },
  { time: '11:00', footfall: 26000, passerBy: 82000, greeted: 74, trialRate: 28, unattended: 35 },
  { time: '12:00', footfall: 30000, passerBy: 98000, greeted: 74, trialRate: 28, unattended: 35 },
  { time: '13:00', footfall: 31000, passerBy: 102000, greeted: 74, trialRate: 28, unattended: 35 },
  { time: '14:00', footfall: 32000, passerBy: 103000, greeted: 74, trialRate: 29, unattended: 35 },
  { time: '15:00', footfall: 33000, passerBy: 108000, greeted: 74, trialRate: 29, unattended: 35 },
  { time: '16:00', footfall: 37000, passerBy: 120000, greeted: 74, trialRate: 29, unattended: 36 },
  { time: '17:00', footfall: 44000, passerBy: 145000, greeted: 74, trialRate: 29, unattended: 36 },
  { time: '18:00', footfall: 55000, passerBy: 180000, greeted: 74, trialRate: 30, unattended: 37 },
  { time: '19:00', footfall: 60000, passerBy: 195000, greeted: 75, trialRate: 30, unattended: 37 },
  { time: '20:00', footfall: 58000, passerBy: 185000, greeted: 74, trialRate: 30, unattended: 37 },
  { time: '21:00', footfall: 25000, passerBy: 80000, greeted: 74, trialRate: 28, unattended: 35 },
  { time: '22:00', footfall: 500, passerBy: 2000, greeted: 74, trialRate: 20, unattended: 25 },
];

export default function HourlyBreakdownChart() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  const axisColor = isDark ? "#475569" : "#94a3b8";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-premium h-[450px]"
    >
      <div className="flex justify-between items-center mb-10">
        <div>
          <h3 className="heading-section">Store Hourly Breakdown</h3>
          <p className="text-[var(--text-secondary)] text-sm">Temporal distribution of key retail metrics.</p>
        </div>
        <div className="text-[10px] font-black tracking-[2px] uppercase text-brand-secondary"> All Stores </div>
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={hourlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="time" stroke={axisColor} fontSize={10} fontWeight={600} tickLine={false} axisLine={false} />
            <YAxis 
              yAxisId="left" 
              stroke={axisColor} 
              fontSize={10} 
              fontWeight={600} 
              tickLine={false} 
              axisLine={false} 
              tickFormatter={(val) => `${val / 1000}k`}
              label={{ value: 'Count', angle: -90, position: 'insideLeft', style: { fill: axisColor, fontSize: 10, fontWeight: 700 } }}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              stroke={axisColor} 
              fontSize={10} 
              fontWeight={600} 
              tickLine={false} 
              axisLine={false} 
              tickFormatter={(val) => `${val}%`}
              label={{ value: '%', angle: 90, position: 'insideRight', style: { fill: axisColor, fontSize: 10, fontWeight: 700 } }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: isDark ? '#020617' : '#FFFFFF',
                borderRadius: '12px',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                fontSize: '11px'
              }} 
            />
            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '20px' }} />
            
            <Bar yAxisId="left" dataKey="footfall" fill="#F87171" radius={[2, 2, 0, 0]} name="Footfall" barSize={20} />
            <Bar yAxisId="left" dataKey="passerBy" fill="#CBD5E1" radius={[2, 2, 0, 0]} name="Passer By" barSize={20} />
            
            <Line yAxisId="right" type="monotone" dataKey="greeted" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" name="Greeted %" />
            <Line yAxisId="right" type="monotone" dataKey="trialRate" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" name="Trial Rate %" />
            <Line yAxisId="right" type="monotone" dataKey="unattended" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" name="Unattended %" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
