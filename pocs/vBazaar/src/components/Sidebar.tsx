import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Camera,
  Bell,
  FileText,
  TrendingUp,
  Settings,
  LogOut,
  Map,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { icon: LayoutDashboard, label: 'Analytics Dashboard', id: 'dashboard' },
  { icon: Users, label: 'Visitor Statistics', id: 'visitors' },
  { icon: Map, label: 'Store Heatmaps', id: 'heatmaps' },
  { icon: Camera, label: 'Vision AI Monitoring', id: 'monitoring' },
  { icon: TrendingUp, label: 'Store Performance', id: 'performance' },
  { icon: Bell, label: 'Alerts & Incidents', id: 'alerts' },
  { icon: FileText, label: 'Generated Reports', id: 'reports' },
];

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { resolvedTheme } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const logoFilter = resolvedTheme === 'dark' ? 'brightness(0) invert(1)' : 'none';

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <motion.aside 
      initial={false}
      animate={{ width: isCollapsed ? 80 : 280 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className="bg-[var(--bg-card)] border-r border-[var(--border-subtle)] h-screen sticky top-0 flex flex-col pt-8 z-50 overflow-hidden shadow-2xl transition-colors duration-300"
    >
      <div className={cn(
        "px-6 mb-10 flex items-center justify-between transition-all",
        isCollapsed ? "flex-col gap-6 px-0" : "flex-row"
      )}>
        <div className="flex flex-col gap-1">
          <AnimatePresence initial={false} mode="wait">
            {isCollapsed ? (
              <motion.img
                key="logo-small"
                src="https://d108xxen99ni2a.cloudfront.net/XenRealitylogo.webp"
                alt="XenReality"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-8 w-8 object-contain"
                style={{ filter: logoFilter }}
              />
            ) : (
              <motion.img
                key="logo-full"
                src="https://d108xxen99ni2a.cloudfront.net/XenRealitylogo.webp"
                alt="XenReality"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-9 object-contain"
                style={{ filter: logoFilter }}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[11px] font-black uppercase tracking-[3px] text-brand-secondary whitespace-nowrap"
              >
                XenTrack
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-slate-500 hover:text-[var(--text-primary)] transition-all active:scale-90",
            isCollapsed && "mx-auto"
          )}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = item.id === 'dashboard';
          return (
            <button
              key={item.id}
              className={cn(
                "w-full flex items-center px-4 py-2.5 rounded-xr-lg text-[13px] font-medium transition-all group relative overflow-hidden",
                isCollapsed ? "justify-center" : "gap-3",
                isActive 
                  ? "text-[var(--text-primary)] bg-black/[0.03] dark:bg-white/5 border border-black/[0.05] dark:border-white/5 shadow-inner" 
                  : "text-slate-400 hover:text-[var(--text-primary)] hover:bg-black/[0.02] dark:hover:bg-white/5"
              )}
            >
              {/* Active Indicator Pin */}
              {isActive && (
                <motion.div 
                  layoutId="activePin"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3 rounded-full bg-brand-tertiary"
                />
              )}
              
              <item.icon className={cn(
                "size-4.5 transition-all duration-300",
                isActive 
                  ? "text-brand-tertiary scale-110 drop-shadow-[0_0_10px_rgba(245,130,32,0.6)]" 
                  : "text-slate-500 group-hover:text-brand-secondary group-hover:scale-105"
              )} />
              
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 1, x: -10 }} 
                    className="whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </nav>

      <div className="p-4 mt-auto border-t border-[var(--border-subtle)] space-y-1">
        <button className={cn(
          "w-full flex items-center px-4 py-2.5 text-slate-400 hover:text-[var(--text-primary)] transition-all text-[13px] rounded-lg hover:bg-black/[0.02] dark:hover:bg-white/5 group",
          isCollapsed ? "justify-center" : "gap-3"
        )}>
          <Settings className="size-4.5 text-slate-500 group-hover:rotate-45 transition-transform" />
          {!isCollapsed && <span>Settings</span>}
        </button>
        <button
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center px-4 py-2.5 text-slate-500 hover:text-red-500 transition-all text-[13px] rounded-lg hover:bg-red-500/5 group",
            isCollapsed ? "justify-center" : "gap-3"
          )}>
          <LogOut className="size-4.5 group-hover:-translate-x-1 transition-transform" />
          {!isCollapsed && <span>Log Out</span>}
        </button>
      </div>
    </motion.aside>
  );
}
