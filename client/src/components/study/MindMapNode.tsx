import { Handle, Position } from '@xyflow/react';
import { clsx } from 'clsx';
import { Network } from 'lucide-react';

const DEPTH = [
  { bgTop: '#f0f9ff', bgBot: '#e0f2fe', border: '#38bdf8', text: '#0369a1', shadow: 'rgba(56, 189, 248, 0.2)' }, // Root (Cyan/Blue)
  { bgTop: '#fdf2f8', bgBot: '#fce7f3', border: '#f472b6', text: '#be185d', shadow: 'rgba(244, 114, 182, 0.2)' }, // L1 (Pink)
  { bgTop: '#f0fdf4', bgBot: '#dcfce7', border: '#4ade80', text: '#15803d', shadow: 'rgba(74, 222, 128, 0.2)' }, // L2 (Green)
  { bgTop: '#faf5ff', bgBot: '#f3e8ff', border: '#c084fc', text: '#7e22ce', shadow: 'rgba(192, 132, 252, 0.2)' }, // L3 (Purple)
  { bgTop: '#fff7ed', bgBot: '#ffedd5', border: '#fb923c', text: '#c2410c', shadow: 'rgba(251, 146, 60, 0.2)' }, // L4 (Orange)
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
          ? `0 10px 40px -10px ${c.shadow}, inset 0 1px 0 0 rgba(255,255,255,0.5)` 
          : `0 4px 20px -5px rgba(0,0,0,0.05), inset 0 1px 0 0 rgba(255,255,255,0.5)`,
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
