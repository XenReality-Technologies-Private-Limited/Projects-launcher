import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options = [
    { id: 'light', icon: Sun, label: 'Light' },
    { id: 'dark', icon: Moon, label: 'Dark' },
  ] as const;

  return (
    <div className="flex items-center gap-1 p-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl">
      {options.map((option) => {
        const IsActive = theme === option.id;
        return (
          <button
            key={option.id}
            onClick={() => setTheme(option.id)}
            className={cn(
              "relative p-2 rounded-lg transition-all duration-200 group",
              IsActive ? "text-white" : "text-slate-400 hover:text-slate-200"
            )}
            title={option.label}
          >
            {IsActive && (
              <motion.div
                layoutId="theme-pill"
                className="absolute inset-0 bg-brand-tertiary rounded-lg shadow-[0_0_15px_rgba(245,130,32,0.4)]"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
            <option.icon className="size-4 relative z-10" />
            
            {/* Tooltip on hover */}
            <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
