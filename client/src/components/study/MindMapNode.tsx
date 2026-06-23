import { Handle, Position } from '@xyflow/react';
import { clsx } from 'clsx';
import { Network } from 'lucide-react';

const DEPTH = [
  { bgTop: 'rgba(236, 72, 153, 0.15)', bgBot: 'rgba(236, 72, 153, 0.05)', border: 'rgba(236, 72, 153, 0.3)', text: '#db2777', shadow: 'rgba(236, 72, 153, 0.2)' }, // Root (Pink)
  { bgTop: 'rgba(139, 92, 246, 0.15)', bgBot: 'rgba(139, 92, 246, 0.05)', border: 'rgba(139, 92, 246, 0.3)', text: '#7c3aed', shadow: 'rgba(139, 92, 246, 0.2)' }, // L1 (Violet)
  { bgTop: 'rgba(59, 130, 246, 0.15)', bgBot: 'rgba(59, 130, 246, 0.05)', border: 'rgba(59, 130, 246, 0.3)', text: '#2563eb', shadow: 'rgba(59, 130, 246, 0.2)' }, // L2 (Blue)
  { bgTop: 'rgba(16, 185, 129, 0.15)', bgBot: 'rgba(16, 185, 129, 0.05)', border: 'rgba(16, 185, 129, 0.3)', text: '#059669', shadow: 'rgba(16, 185, 129, 0.2)' }, // L3 (Green)
  { bgTop: 'rgba(245, 158, 11, 0.15)', bgBot: 'rgba(245, 158, 11, 0.05)', border: 'rgba(245, 158, 11, 0.3)', text: '#d97706', shadow: 'rgba(245, 158, 11, 0.2)' }, // L4 (Orange)
];

const dc = (d: number) => DEPTH[Math.min(d, DEPTH.length - 1)];

export default function MindMapNode({ data, selected }: any) {
  const depth = data.depth || 0;
  const isRoot = depth === 0;
  const c = dc(depth);

  return (
    <div
      className={clsx(
        "relative flex items-center justify-center transition-all duration-300 backdrop-blur-md",
        isRoot ? "rounded-[1.25rem] p-5 min-w-[140px]" : "rounded-xl px-5 py-3 min-w-[120px] max-w-[220px]",
        selected ? "z-50 scale-[1.02] ring-2 ring-offset-2 ring-offset-slate-950" : "hover:scale-[1.02]"
      )}
      style={{
        background: `linear-gradient(180deg, ${c.bgTop} 0%, ${c.bgBot} 100%)`,
        border: `1px solid ${selected ? c.text : c.border}`,
        boxShadow: selected 
          ? `0 10px 40px -10px ${c.shadow}, inset 0 1px 0 0 rgba(255,255,255,0.15)` 
          : `0 4px 20px -5px rgba(0,0,0,0.3), inset 0 1px 0 0 rgba(255,255,255,0.05)`,
        color: c.text,
        ...(selected ? { '--tw-ring-color': c.shadow } as any : {})
      }}
    >
      <Handle type="target" position={Position.Left} style={{ top: '50%', left: '50%', opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ top: '50%', left: '50%', opacity: 0 }} />
      
      <div className="flex flex-col items-center gap-1.5 z-10 pointer-events-none text-center">
        {isRoot && <Network className="w-5 h-5 mb-0.5 opacity-80" strokeWidth={1.5} style={{ color: c.text }} />}
        <span 
          className={clsx(
            "leading-tight break-words",
            isRoot ? "text-[13px] font-bold tracking-widest uppercase" : "text-[13px] font-medium tracking-wide"
          )}
        >
          {data.label}
        </span>
      </div>
    </div>
  );
}
