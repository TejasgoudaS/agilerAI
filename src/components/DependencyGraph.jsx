import { useMemo } from 'react';
import ReactFlow, { Background, Controls, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';
import { useAppStore } from '../store/appStore';

export default function DependencyGraph() {
  const { stories, dependencies } = useAppStore();

  const { nodes, edges } = useMemo(() => {
    if (!stories.length) return { nodes: [], edges: [] };

    // Basic auto-layout logic (simplified for demo)
    // In a real app, use dagre.js for proper hierarchical layout
    const cols = Math.ceil(Math.sqrt(stories.length));
    
    const nodes = stories.map((story, i) => ({
      id: story.id,
      position: { 
        x: (i % cols) * 250 + 50, 
        y: Math.floor(i / cols) * 150 + 50 
      },
      data: { 
        label: (
          <div className="p-2 w-48 text-left">
            <div className="font-bold text-xs text-primary mb-1">{story.id}</div>
            <div className="text-xs truncate">{story.title}</div>
          </div>
        ) 
      },
      style: {
        background: '#1e293b',
        color: '#f8fafc',
        border: '1px solid #334155',
        borderRadius: '8px',
      }
    }));

    const edges = dependencies.map((dep, i) => ({
      id: `e${dep.from}-${dep.to}-${i}`,
      source: dep.from,
      target: dep.to,
      animated: true,
      label: dep.reason,
      style: { stroke: '#6366f1' },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#6366f1',
      },
    }));

    return { nodes, edges };
  }, [stories, dependencies]);

  if (!stories.length) return <div className="text-slate-400">No dependencies to show yet.</div>;

  return (
    <div className="h-[600px] w-full bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      <ReactFlow 
        nodes={nodes} 
        edges={edges}
        fitView
        attributionPosition="bottom-right"
      >
        <Background color="#334155" gap={16} />
        <Controls className="bg-slate-800 border-slate-700 fill-slate-200" />
      </ReactFlow>
    </div>
  );
}
