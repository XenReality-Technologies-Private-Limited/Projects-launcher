import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Legend, 
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { motion } from 'motion/react';
import { useTheme } from '../context/ThemeContext';

const dwellTimeData = [
  { name: '< 2 min', value: 20.1, color: '#3B82F6' },
  { name: '2-10 min', value: 30.4, color: '#10B981' },
  { name: '> 10 min', value: 49.6, color: '#F59E0B' },
];

const genderData = [
  { name: 'Footfall', male: 320000, female: 130000 },
  { name: 'Passer By', male: 1100000, female: 400000 },
];

const ageData = [
  { name: 'Footfall', adult: 450000, child: 5800 },
  { name: 'Passer By', adult: 1450000, child: 15000 },
];

const groupData = [
  { name: 'Footfall', individuals: 281600, groups: 60100 },
];

export default function DemographicsSection() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  const axisColor = isDark ? "#475569" : "#94a3b8";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Row 1: Dwell Time & Gender Split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 xl:col-span-2">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-premium h-[350px]">
          <h3 className="heading-section mb-2">Dwell Time</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={dwellTimeData}
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
              >
                {dwellTimeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                 contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                 formatter={(value) => `${value}%`}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-premium h-[350px]">
          <h3 className="heading-section mb-6">Gender Split</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={genderData} barGap={8}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="name" stroke={axisColor} fontSize={10} fontWeight={600} axisLine={false} tickLine={false} />
              <YAxis stroke={axisColor} fontSize={10} fontWeight={600} axisLine={false} tickLine={false} tickFormatter={(val) => `${val / 1000}k`} />
              <Tooltip cursor={{ fill: 'transparent' }} />
              <Legend iconType="square" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
              <Bar dataKey="male" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Male" />
              <Bar dataKey="female" fill="#EC4899" radius={[4, 4, 0, 0]} name="Female" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Row 2: Adult/Child & Individual/Group */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 xl:col-span-2">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-premium h-[350px]">
          <h3 className="heading-section mb-6">Adult / Child</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ageData} barGap={8}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="name" stroke={axisColor} fontSize={10} fontWeight={600} axisLine={false} tickLine={false} />
              <YAxis stroke={axisColor} fontSize={10} fontWeight={600} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'transparent' }} />
              <Legend iconType="square" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
              <Bar dataKey="adult" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Adult" />
              <Bar dataKey="child" fill="#F97316" radius={[4, 4, 0, 0]} name="Child" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-premium h-[350px]">
          <h3 className="heading-section mb-6">Individual / Group</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={groupData} barGap={8}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="name" stroke={axisColor} fontSize={10} fontWeight={600} axisLine={false} tickLine={false} />
              <YAxis stroke={axisColor} fontSize={10} fontWeight={600} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'transparent' }} />
              <Legend iconType="square" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
              <Bar dataKey="individuals" fill="#0EA5E9" radius={[4, 4, 0, 0]} name="Individuals" />
              <Bar dataKey="groups" fill="#A855F7" radius={[4, 4, 0, 0]} name="Groups" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </div>
  );
}
