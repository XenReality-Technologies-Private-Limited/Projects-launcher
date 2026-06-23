import { Maximize2, ShieldAlert, Circle } from 'lucide-react';
import { cn } from '../lib/utils';

const cameras = [
  { id: 'CAM-01', location: 'Main Entrance', status: 'active', alerts: 0, image: 'https://images.unsplash.com/photo-1541888941259-7727ee143ab0?auto=format&fit=crop&q=80&w=800' },
  { id: 'CAM-02', location: 'Retail Floor B', status: 'active', alerts: 2, image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=800' },
  { id: 'CAM-03', location: 'Warehouse A', status: 'warning', alerts: 1, image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=800' },
  { id: 'CAM-04', location: 'Loading Dock', status: 'active', alerts: 0, image: 'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&q=80&w=800' },
];

export default function CameraMonitoring() {
  return (
    <div className="card-premium group/container relative overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 relative z-10">
        <div>
          <div className="eyebrow mb-1">Optical Edge</div>
          <h3 className="heading-section">Vision AI Monitoring</h3>
          <p className="text-slate-500 text-sm mt-1">Active heuristic tracking across 12 sectors.</p>
        </div>
        <div className="flex gap-2.5">
          <button className="btn-outline-dark !px-3 font-bold !text-[10px] uppercase tracking-widest">Multi-Grid</button>
          <button className="btn-primary !px-3 font-bold !text-[10px] uppercase tracking-widest">Add Stream</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {cameras.map((cam) => (
          <div key={cam.id} className="relative group rounded-2xl overflow-hidden bg-black/[0.05] dark:bg-black/40 border border-black/5 dark:border-white/5 transition-all duration-500 hover:border-brand-secondary/30 hover:shadow-2xl">
            <div className="aspect-video relative overflow-hidden">
              <img 
                src={cam.image} 
                alt={cam.location} 
                className="w-full h-full object-cover grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-80 transition-all duration-700 group-hover:scale-105"
              />
              
              {/* Scanline Effect */}
              <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] z-10 bg-[length:100%_4px,3px_100%]" />
              
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-xl px-2.5 py-1 rounded-lg border border-white/10">
                <Circle className={cn(
                  "size-1.5 fill-current",
                  cam.status === 'active' ? 'text-brand-quaternary animate-pulse' : 'text-yellow-500'
                )} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/90">{cam.id}</span>
              </div>
              
              <button className="absolute bottom-3 right-3 p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-xl text-white opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                <Maximize2 className="size-4" />
              </button>
            </div>
            
            <div className="p-4 bg-gradient-to-t from-black/20 dark:from-black/40 to-transparent">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-bold text-[var(--text-primary)]">{cam.location}</span>
                {cam.alerts > 0 && (
                  <span className="flex items-center gap-1.5 text-[9px] font-black text-white bg-red-500 px-2 py-0.5 rounded shadow-[0_0_10px_rgba(239,68,68,0.5)] uppercase tracking-tighter">
                    <ShieldAlert className="size-2.5" />
                    {cam.alerts} Crit
                  </span>
                )}
              </div>
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest flex items-center gap-2">
                <span className="size-1 rounded-full bg-brand-secondary/40" />
                Detections: Active
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
