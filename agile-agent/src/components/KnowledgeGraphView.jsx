import { useMemo } from 'react';
import ReactFlow, { Background, Controls, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';
import { useAppStore } from '../store/appStore';
import { Network } from 'lucide-react';

const TYPE_STYLES = {
  service:  { bg: '#6366f1', border: '#818cf8', emoji: '⚙️' },
  api:      { bg: '#0ea5e9', border: '#38bdf8', emoji: '🔌' },
  database: { bg: '#f59e0b', border: '#fbbf24', emoji: '🗄️' },
  external: { bg: '#ef4444', border: '#f87171', emoji: '🌐' },
  team:     { bg: '#10b981', border: '#34d399', emoji: '👥' },
};

export default function KnowledgeGraphView() {
  const { knowledgeGraph } = useAppStore();

  const { nodes, edges } = useMemo(() => {
    if (!knowledgeGraph || !knowledgeGraph.entities || knowledgeGraph.entities.length === 0) {
      return { nodes: [], edges: [] };
    }

    const cols = Math.ceil(Math.sqrt(knowledgeGraph.entities.length));

    const nodes = knowledgeGraph.entities.map((entity, i) => {
      const style = TYPE_STYLES[entity.type] || TYPE_STYLES.service;
      return {
        id: entity.id,
        position: {
          x: (i % cols) * 280 + 50,
          y: Math.floor(i / cols) * 160 + 50
        },
        data: {
          label: (
            <div className="p-2 w-52 text-left">
              <div className="flex items-center gap-2 mb-1">
                <span>{style.emoji}</span>
                <span className="text-xs font-bold uppercase tracking-wider opacity-70">{entity.type}</span>
              </div>
              <div className="text-sm font-semibold truncate">{entity.name}</div>
            </div>
          )
        },
        style: {
          background: '#1e293b',
          color: '#f8fafc',
          border: `2px solid ${style.border}`,
          borderRadius: '12px',
          boxShadow: `0 0 15px ${style.bg}22`,
        }
      };
    });

    const edges = (knowledgeGraph.relationships || []).map((rel, i) => ({
      id: `kg-e${i}`,
      source: rel.from,
      target: rel.to,
      animated: true,
      label: rel.label,
      style: { stroke: '#6366f1' },
      labelStyle: { fill: '#94a3b8', fontSize: 11, fontWeight: 500 },
      labelBgStyle: { fill: '#0f172a', fillOpacity: 0.9 },
      labelBgPadding: [6, 3],
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#6366f1',
      },
    }));

    return { nodes, edges };
  }, [knowledgeGraph]);

  if (!knowledgeGraph || !knowledgeGraph.entities || knowledgeGraph.entities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-surface/30 border border-slate-700/50 rounded-xl text-center">
        <Network className="w-12 h-12 text-slate-600 mb-4" />
        <h3 className="text-xl font-semibold text-slate-300">No Knowledge Graph Available</h3>
        <p className="text-slate-500 mt-2 max-w-md">
          The Knowledge Graph is extracted by the Architect Agent when the CrewAI backend is running.
          Start the agent server to enable this feature.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 px-2">
        {Object.entries(TYPE_STYLES).map(([type, style]) => (
          <div key={type} className="flex items-center gap-2 text-sm">
            <span>{style.emoji}</span>
            <span className="text-slate-400 capitalize">{type}</span>
          </div>
        ))}
      </div>

      {/* Graph */}
      <div className="h-[600px] w-full bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          attributionPosition="bottom-right"
        >
          <Background color="#334155" gap={20} />
          <Controls className="bg-slate-800 border-slate-700 fill-slate-200" />
        </ReactFlow>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(TYPE_STYLES).map(([type, style]) => {
          const count = knowledgeGraph.entities.filter(e => e.type === type).length;
          if (count === 0) return null;
          return (
            <div key={type} className="bg-surface border border-slate-700 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-white">{count}</div>
              <div className="text-xs text-slate-400 capitalize">{type}s</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
