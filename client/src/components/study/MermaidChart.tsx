import { useState, useMemo, useCallback, useEffect } from 'react';
import { Sparkles, X, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactFlow, Background, Controls, Node, Edge, BackgroundVariant, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import MindMapNode from './MindMapNode';

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

// ── Constants & Parser ────────────────────────────────────────────────────────
const RADII = [0, 200, 400, 600, 800];
const DEPTH = [
  { stroke: '#22d3ee' },
  { stroke: '#818cf8' },
  { stroke: '#22c55e' },
  { stroke: '#f472b6' },
  { stroke: '#fb923c' },
];

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

function countLeaves(n: TreeNode): number {
  return n.children.length === 0 ? 1 : n.children.reduce((s, c) => s + countLeaves(c), 0);
}

function buildLayout(root: TreeNode): Map<string, NodePos> {
  const map = new Map<string, NodePos>();
  map.set(root.id, { x: 0, y: 0, node: root });

  function place(node: TreeNode, startA: number, endA: number, depth: number) {
    if (!node.children.length) return;
    const r = RADII[Math.min(depth, RADII.length - 1)];
    const total = node.children.reduce((s, c) => s + countLeaves(c), 0) || 1;
    let a = startA;
    for (const child of node.children) {
      const span = ((endA - startA) * countLeaves(child)) / total;
      const mid = a + span / 2;
      const x = r * Math.cos(mid);
      const y = r * Math.sin(mid);
      map.set(child.id, { x, y, node: child });
      place(child, a, a + span, depth + 1);
      a += span;
    }
  }

  place(root, -Math.PI / 2, (3 * Math.PI) / 2, 1);
  return map;
}

function autoExplain(label: string, depth: number, parentLabel?: string): string {
  const depthWords = ['core concept', 'main topic', 'sub-topic', 'detail', 'specific point'];
  const word = depthWords[Math.min(depth - 1, depthWords.length - 1)];
  const parent = parentLabel ? ` under "${parentLabel}"` : '';
  return `"${label}" is a ${word}${parent} covered in this document. Click to learn more by asking the AI Assistant about it.`;
}

const nodeTypes = {
  custom: MindMapNode,
};

// ── Main component ────────────────────────────────────────────────────────────
export default function MermaidChart({ data }: MermaidChartProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { chart, explanations } = useMemo(() => {
    if (!data) return { chart: '', explanations: {} as Record<string, string> };
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
  const allNodes = useMemo(() => Array.from(layout.values()), [layout]);

  const parentMap = useMemo(() => {
    const m = new Map<string, TreeNode>();
    const walk = (n: TreeNode) => {
      for (const c of n.children) { m.set(c.id, n); walk(c); }
    };
    if (tree) walk(tree);
    return m;
  }, [tree]);

  const getExplanation = useCallback((node: TreeNode): string => {
    if (explanations[node.label]) return explanations[node.label];
    const key = Object.keys(explanations).find(k => k.toLowerCase() === node.label.toLowerCase());
    if (key) return explanations[key];
    const fuzzy = Object.keys(explanations).find(
      k => k.toLowerCase().includes(node.label.toLowerCase()) || node.label.toLowerCase().includes(k.toLowerCase())
    );
    if (fuzzy) return explanations[fuzzy];
    const parent = parentMap.get(node.id);
    return autoExplain(node.label, node.depth, parent?.label);
  }, [explanations, parentMap]);

  const initialNodes = useMemo<Node[]>(() => {
    return allNodes.map((n) => {
      // center offset so handles align
      const x = n.x - 75; 
      const y = n.y - 30;
      return {
        id: n.node.id,
        type: 'custom',
        position: { x, y },
        data: { label: n.node.label, depth: n.node.depth },
      };
    });
  }, [allNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    // Only set nodes initially or when the tree completely changes
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    // Dynamically calculate edges based on tree and selectedId
    const newEdges: Edge[] = [];
    const walk = (n: TreeNode) => {
      for (const c of n.children) {
        const strokeColor = DEPTH[Math.min(c.depth, DEPTH.length - 1)].stroke;
        const isConnected = selectedId === n.id || selectedId === c.id;
        
        newEdges.push({
          id: `e-${n.id}-${c.id}`,
          source: n.id,
          target: c.id,
          type: 'default',
          animated: isConnected,
          style: { 
            stroke: strokeColor, 
            strokeWidth: isConnected ? 3 : (c.depth === 1 ? 2 : 1.5), 
            opacity: isConnected ? 1 : 0.35,
            filter: isConnected ? `drop-shadow(0 0 8px ${strokeColor})` : 'none',
          },
        });
        walk(c);
      }
    };
    if (tree) walk(tree);
    setEdges(newEdges);
    
    // Also update node 'selected' status without touching position
    setNodes((nds) => 
      nds.map((node) => ({
        ...node,
        selected: node.id === selectedId,
      }))
    );
  }, [tree, selectedId, setEdges, setNodes]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedId(prev => prev === node.id ? null : node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedId(null);
  }, []);

  const selectedNode = selectedId ? layout.get(selectedId)?.node : null;
  const selectedExplanation = selectedNode ? getExplanation(selectedNode) : null;

  if (!chart || !tree) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center gap-4">
        <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-primary/30" />
        </div>
        <p className="text-sm text-muted-foreground">No mind map available yet.</p>
        <p className="text-xs text-muted-foreground/50">Upload a document and enable the "Mind Map" option.</p>
      </div>
    );
  }

  const selectedColor = selectedNode ? DEPTH[Math.min(selectedNode.depth, DEPTH.length - 1)] : DEPTH[0];

  return (
    <div className="w-full h-full flex flex-col space-y-4 relative">
      <div className="flex items-center gap-3 flex-wrap z-10 absolute top-4 left-4">
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-md border border-border/50 text-primary text-[11px] font-bold uppercase tracking-wider shadow-lg">
          <Sparkles className="w-3 h-3" />
          {allNodes.length} nodes · Interactive Canvas
        </span>
      </div>

      <div className="w-full h-full rounded-3xl overflow-hidden border border-border/20 shadow-2xl relative bg-background flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          className="bg-black/20"
          nodesDraggable={true}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={2} color="#ffffff10" />
          <Controls className="!bg-transparent !border-none !shadow-xl [&_button]:!bg-black/40 [&_button]:backdrop-blur-md [&_button]:!border-white/10 [&_button]:!border-b [&_button]:!fill-white hover:[&_button]:!bg-black/60 [&_button:first-child]:rounded-t-xl [&_button:last-child]:rounded-b-xl [&_button:last-child]:!border-b-0 overflow-hidden" showInteractive={false} />
        </ReactFlow>

        {!selectedId && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center justify-center gap-1.5 pointer-events-none bg-background/60 backdrop-blur-md px-4 py-2 rounded-full border border-border/20 shadow-lg">
            <Info className="w-3 h-3 text-white/50" />
            <span className="text-[10px] text-white/70 font-medium">Use mouse to pan and zoom. Click a node to explore.</span>
          </div>
        )}
      </div>

      {/* ── Explanation panel ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedNode && selectedExplanation && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute bottom-8 right-8 md:w-[380px] rounded-[1.25rem] p-5 z-20 backdrop-blur-2xl"
            style={{
              background: `rgba(9, 9, 11, 0.75)`,
              border: `1px solid rgba(255, 255, 255, 0.08)`,
              boxShadow: `0 24px 48px -12px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(255,255,255,0.05)`,
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-3 min-w-0">
                <div className="flex items-center gap-2.5">
                  <div 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ 
                      backgroundColor: selectedColor.stroke, 
                      boxShadow: `0 0 12px ${selectedColor.stroke}, inset 0 0 4px rgba(255,255,255,0.5)` 
                    }} 
                  />
                  <h4 className="text-[15px] font-semibold text-slate-100 tracking-wide leading-none">
                    {selectedNode.label}
                  </h4>
                </div>
                <p className="text-[13px] text-slate-400 leading-relaxed font-medium pl-[1.125rem] border-l border-white/5">
                  {selectedExplanation}
                </p>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="p-1.5 -mr-1 -mt-1 rounded-full hover:bg-white/10 transition-colors flex-shrink-0 text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
