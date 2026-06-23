import { Handle, Position } from '@xyflow/react';
import { clsx } from 'clsx';
import { Network } from 'lucide-react';

const DEPTH = [
  { bgTop: 'rgba(34, 211, 238, 0.12)', bgBot: 'rgba(34, 211, 238, 0.02)', border: 'rgba(34, 211, 238, 0.25)', text: '#67e8f9', shadow: 'rgba(34, 211, 238, 0.15)' }, // Root (Cyan)
  { bgTop: 'rgba(96, 165, 250, 0.12)', bgBot: 'rgba(96, 165, 250, 0.02)', border: 'rgba(96, 165, 250, 0.25)', text: '#93c5fd', shadow: 'rgba(96, 165, 250, 0.15)' }, // L1 (Blue)
  { bgTop: 'rgba(52, 211, 153, 0.12)', bgBot: 'rgba(52, 211, 153, 0.02)', border: 'rgba(52, 211, 153, 0.25)', text: '#6ee7b7', shadow: 'rgba(52, 211, 153, 0.15)' }, // L2 (Green)
  { bgTop: 'rgba(244, 114, 182, 0.12)', bgBot: 'rgba(244, 114, 182, 0.02)', border: 'rgba(244, 114, 182, 0.25)', text: '#f9a8d4', shadow: 'rgba(244, 114, 182, 0.15)' }, // L3 (Pink)
  { bgTop: 'rgba(251, 146, 60, 0.12)', bgBot: 'rgba(251, 146, 60, 0.02)', border: 'rgba(251, 146, 60, 0.25)', text: '#fdba74', shadow: 'rgba(251, 146, 60, 0.15)' }, // L4 (Orange)
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
