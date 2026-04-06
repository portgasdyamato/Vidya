import { useState, useMemo } from 'react';
import { Sparkles, X, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────────
interface TreeNode {
  id: string;
  label: string;
  children: TreeNode[];
  depth: number;
}

interface NodePos {
  x: number;
  y: number;
  node: TreeNode;
}

interface MermaidChartProps {
  data: string | { chart: string; explanations: Record<string, string> } | null | undefined;
}

// ── SVG canvas ────────────────────────────────────────────────────────────────
const W = 1000;
const H = 680;
const CX = W / 2;
const CY = H / 2;

// Radii per depth level from center
const RADII = [0, 190, 350, 490, 600];

// Colors per depth
const DEPTH = [
  { bg: '#0c3a4a', stroke: '#22d3ee', text: '#a5f3fc', label: '#22d3ee' },  // root
  { bg: '#1e1254', stroke: '#818cf8', text: '#c7d2fe', label: '#a78bfa' },  // L1
  { bg: '#052e16', stroke: '#22c55e', text: '#bbf7d0', label: '#4ade80' },  // L2
  { bg: '#500724', stroke: '#f472b6', text: '#fce7f3', label: '#f9a8d4' },  // L3
  { bg: '#431407', stroke: '#fb923c', text: '#ffedd5', label: '#fdba74' },  // L4
];

const dc = (d: number) => DEPTH[Math.min(d, DEPTH.length - 1)];

// ── Parser ────────────────────────────────────────────────────────────────────
function parseMindmap(chart: string): TreeNode | null {
  try {
    const lines = chart.split('\n');
    const stack: Array<{ node: TreeNode; indent: number }> = [];
    let root: TreeNode | null = null;
    let id = 0;

    for (const line of lines) {
      const raw = line;
      const trimmed = raw.trim();
      if (!trimmed || trimmed === 'mindmap') continue;

      const indent = raw.search(/\S/);

      let label = trimmed
        .replace(/^root\(\((.+?)\)\)$/, '$1')
        .replace(/^\(\((.+?)\)\)$/, '$1')
        .replace(/^\[(.+?)\]$/, '$1')
        .replace(/^\((.+?)\)$/, '$1')
        .replace(/^"(.+?)"$/, '$1')
        .replace(/^`(.+?)`$/, '$1')
        .replace(/^:::.+$/, '')
        .trim();

      if (!label) continue;

      const node: TreeNode = { id: `n${id++}`, label, children: [], depth: 0 };

      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      if (stack.length === 0) {
        root = node;
      } else {
        const parent = stack[stack.length - 1].node;
        node.depth = parent.depth + 1;
        parent.children.push(node);
      }

      stack.push({ node, indent });
    }

    return root;
  } catch (_) {
    return null;
  }
}

// ── Layout: leaf-weighted radial placement ────────────────────────────────────
function countLeaves(n: TreeNode): number {
  return n.children.length === 0 ? 1 : n.children.reduce((s, c) => s + countLeaves(c), 0);
}

function buildLayout(root: TreeNode): Map<string, NodePos> {
  const map = new Map<string, NodePos>();
  map.set(root.id, { x: CX, y: CY, node: root });

  function place(node: TreeNode, startA: number, endA: number, depth: number) {
    if (!node.children.length) return;
    const r = RADII[Math.min(depth, RADII.length - 1)];
    const total = node.children.reduce((s, c) => s + countLeaves(c), 0) || 1;
    let a = startA;
    for (const child of node.children) {
      const span = ((endA - startA) * countLeaves(child)) / total;
      const mid = a + span / 2;
      const x = CX + r * Math.cos(mid);
      const y = CY + r * Math.sin(mid);
      map.set(child.id, { x, y, node: child });
      place(child, a, a + span, depth + 1);
      a += span;
    }
  }

  place(root, -Math.PI / 2, (3 * Math.PI) / 2, 1);
  return map;
}

// ── Curved edge path ──────────────────────────────────────────────────────────
function edge(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cx1 = x1 + dx * 0.4;
  const cy1 = y1 + dy * 0.4;
  const cx2 = x2 - dx * 0.4;
  const cy2 = y2 - dy * 0.4;
  return `M${x1},${y1} C${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`;
}

// ── Node box dimensions ───────────────────────────────────────────────────────
function nodeDims(depth: number, label: string) {
  if (depth === 0) return { w: 0, h: 0, r: 52 }; // circle
  const baseW = Math.min(Math.max(label.length * 7.5 + 20, 80), depth === 1 ? 150 : 130);
  const h = depth === 1 ? 38 : 32;
  return { w: baseW, h, r: 0 };
}

// ── Truncate ─────────────────────────────────────────────────────────────────
function trunc(s: string, n = 18) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// ── Fallback explanation generator ───────────────────────────────────────────
function autoExplain(label: string, depth: number, parentLabel?: string): string {
  const depthWords = ['core concept', 'main topic', 'sub-topic', 'detail', 'specific point'];
  const word = depthWords[Math.min(depth - 1, depthWords.length - 1)];
  const parent = parentLabel ? ` under "${parentLabel}"` : '';
  return `"${label}" is a ${word}${parent} covered in this document. Click to learn more by asking the AI Assistant about it.`;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MermaidChart({ data }: MermaidChartProps) {
  const [selected, setSelected] = useState<TreeNode | null>(null);

  // ── Normalise data ────────────────────────────────────────────────────────
  const { chart, explanations } = useMemo<{
    chart: string;
    explanations: Record<string, string>;
  }>(() => {
    if (!data) return { chart: '', explanations: {} };

    // Handle string that might be JSON
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (parsed.chart) return { chart: parsed.chart, explanations: parsed.explanations || {} };
      } catch (_) {}
      return { chart: data, explanations: {} };
    }

    const d = data as { chart: string; explanations?: Record<string, string> };
    return { chart: d.chart || '', explanations: d.explanations || {} };
  }, [data]);

  const tree = useMemo(() => (chart ? parseMindmap(chart) : null), [chart]);
  const layout = useMemo(() => (tree ? buildLayout(tree) : new Map()), [tree]);

  // ── Get all nodes flat ────────────────────────────────────────────────────
  const allNodes = useMemo<NodePos[]>(() => Array.from(layout.values()), [layout]);

  // ── Find parent of a node (for fallback explanation) ─────────────────────
  const parentMap = useMemo<Map<string, TreeNode>>(() => {
    const m = new Map<string, TreeNode>();
    const walk = (n: TreeNode) => {
      for (const c of n.children) { m.set(c.id, n); walk(c); }
    };
    if (tree) walk(tree);
    return m;
  }, [tree]);

  // ── Get explanation (always returns something) ────────────────────────────
  const getExplanation = (node: TreeNode): string => {
    // Exact match
    if (explanations[node.label]) return explanations[node.label];
    // Case-insensitive
    const key = Object.keys(explanations).find(
      k => k.toLowerCase() === node.label.toLowerCase()
    );
    if (key) return explanations[key];
    // Fuzzy
    const fuzzy = Object.keys(explanations).find(
      k => k.toLowerCase().includes(node.label.toLowerCase()) ||
           node.label.toLowerCase().includes(k.toLowerCase())
    );
    if (fuzzy) return explanations[fuzzy];
    // Fallback
    const parent = parentMap.get(node.id);
    return autoExplain(node.label, node.depth, parent?.label);
  };

  // ── Edge list ─────────────────────────────────────────────────────────────
  const edges = useMemo<Array<{ path: string; depth: number }>>(() => {
    const result: Array<{ path: string; depth: number }> = [];
    const walk = (node: TreeNode) => {
      const pPos = layout.get(node.id);
      if (!pPos) return;
      for (const child of node.children) {
        const cPos = layout.get(child.id);
        if (cPos) result.push({ path: edge(pPos.x, pPos.y, cPos.x, cPos.y), depth: child.depth });
        walk(child);
      }
    };
    if (tree) walk(tree);
    return result;
  }, [tree, layout]);

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!chart || !tree) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center gap-4">
        <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-primary/30" />
        </div>
        <p className="text-sm text-muted-foreground">No mind map available yet.</p>
        <p className="text-xs text-muted-foreground/50">
          Upload a document and enable the "Mind Map" option.
        </p>
      </div>
    );
  }

  const selectedExplanation = selected ? getExplanation(selected) : null;

  return (
    <div className="w-full space-y-4">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold uppercase tracking-wider">
          <Sparkles className="w-3 h-3" />
          {allNodes.length} nodes · Click any to explore
        </span>
      </div>

      {/* ── SVG Mind Map ─────────────────────────────────────────────────── */}
      <div className="w-full rounded-3xl overflow-hidden border border-white/6 bg-gradient-to-br from-slate-950 to-black shadow-2xl">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="auto"
          style={{ display: 'block', minHeight: '320px' }}
        >
          {/* Background glow */}
          <defs>
            {DEPTH.map((d, i) => (
              <filter key={i} id={`glow-${i}`} x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}
          </defs>

          {/* ── Edges ─────────────────────────────────────────────────────── */}
          {edges.map((e, i) => (
            <path
              key={i}
              d={e.path}
              fill="none"
              stroke={dc(e.depth).stroke}
              strokeWidth={e.depth === 1 ? 2 : 1.5}
              strokeOpacity={0.35}
              strokeDasharray={e.depth > 2 ? '4 3' : undefined}
            />
          ))}

          {/* ── Nodes ─────────────────────────────────────────────────────── */}
          {allNodes.map(({ x, y, node }) => {
            const { w, h, r } = nodeDims(node.depth, node.label);
            const c = dc(node.depth);
            const isRoot = node.depth === 0;
            const isSelected = selected?.id === node.id;
            const label = trunc(node.label, isRoot ? 14 : node.depth === 1 ? 16 : 14);

            return (
              <g
                key={node.id}
                transform={`translate(${x},${y})`}
                onClick={() => setSelected(prev => prev?.id === node.id ? null : node)}
                style={{ cursor: 'pointer' }}
              >
                {isRoot ? (
                  <>
                    {/* Root: double circle */}
                    <circle
                      r={r + 8}
                      fill="none"
                      stroke={c.stroke}
                      strokeWidth={1}
                      strokeOpacity={0.25}
                    />
                    <circle
                      r={r}
                      fill={c.bg}
                      stroke={c.stroke}
                      strokeWidth={isSelected ? 3 : 2}
                      filter="url(#glow-0)"
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={12}
                      fontWeight="800"
                      fill={c.text}
                      style={{ fontFamily: 'Inter, system-ui, sans-serif', pointerEvents: 'none' }}
                    >
                      {label}
                    </text>
                  </>
                ) : (
                  <>
                    {/* Non-root: rounded rectangle */}
                    {isSelected && (
                      <rect
                        x={-w / 2 - 4}
                        y={-h / 2 - 4}
                        width={w + 8}
                        height={h + 8}
                        rx={10}
                        fill="none"
                        stroke={c.stroke}
                        strokeWidth={1.5}
                        strokeOpacity={0.4}
                      />
                    )}
                    <rect
                      x={-w / 2}
                      y={-h / 2}
                      width={w}
                      height={h}
                      rx={8}
                      fill={isSelected ? c.stroke + '33' : c.bg}
                      stroke={c.stroke}
                      strokeWidth={isSelected ? 2 : 1.5}
                      strokeOpacity={isSelected ? 1 : 0.7}
                      filter={`url(#glow-${Math.min(node.depth, DEPTH.length - 1)})`}
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={node.depth === 1 ? 11 : 10}
                      fontWeight={node.depth === 1 ? '700' : '600'}
                      fill={c.text}
                      style={{ fontFamily: 'Inter, system-ui, sans-serif', pointerEvents: 'none' }}
                    >
                      {label}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>

        {/* ── Legend ────────────────────────────────────────────────────── */}
        {!selected && (
          <div className="flex items-center justify-center gap-1.5 pb-4 pointer-events-none">
            <Info className="w-3 h-3 text-white/20" />
            <span className="text-[10px] text-white/20">Click any node to see its explanation</span>
          </div>
        )}
      </div>

      {/* ── Explanation panel ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {selected && selectedExplanation && (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            className="rounded-3xl border p-6"
            style={{
              background: `${dc(selected.depth).bg}ee`,
              borderColor: `${dc(selected.depth).stroke}60`,
              boxShadow: `0 0 40px ${dc(selected.depth).stroke}18`,
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    background: `${dc(selected.depth).stroke}22`,
                    borderColor: `${dc(selected.depth).stroke}50`,
                  }}
                >
                  <Sparkles className="w-5 h-5" style={{ color: dc(selected.depth).label }} />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <h4
                    className="text-base font-black leading-snug"
                    style={{ color: dc(selected.depth).label }}
                  >
                    {selected.label}
                  </h4>
                  <p className="text-sm text-white/65 leading-relaxed">
                    {selectedExplanation}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 text-white/40" />
              </button>
            </div>

            {/* Depth breadcrumb */}
            <div className="mt-4 flex gap-1">
              {Array.from({ length: selected.depth + 1 }).map((_, i) => (
                <span
                  key={i}
                  className="h-1 rounded-full flex-1"
                  style={{
                    background: i === selected.depth
                      ? dc(selected.depth).stroke
                      : `${dc(selected.depth).stroke}25`,
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
