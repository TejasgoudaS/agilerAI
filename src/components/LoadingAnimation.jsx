import { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle2, Bot, Cpu, Shield, Network, Tag, Zap } from 'lucide-react';
import { useAppStore } from '../store/appStore';

const AGENT_ICONS = {
  'Architect Agent': Network,
  'PM Agent': Bot,
  'Engineer Agent': Cpu,
  'QA Agent': Shield,
};

const AGENT_COLORS = {
  'Architect Agent': { text: 'text-violet-400', bg: 'bg-violet-500/15', border: 'border-violet-500/30', glow: 'shadow-violet-500/20', badge: 'bg-violet-500/20 text-violet-300' },
  'PM Agent': { text: 'text-sky-400', bg: 'bg-sky-500/15', border: 'border-sky-500/30', glow: 'shadow-sky-500/20', badge: 'bg-sky-500/20 text-sky-300' },
  'Engineer Agent': { text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', glow: 'shadow-amber-500/20', badge: 'bg-amber-500/20 text-amber-300' },
  'QA Agent': { text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20', badge: 'bg-emerald-500/20 text-emerald-300' },
};

const AGENT_BADGE_LABEL = {
  'PM Agent': 'Draft',
  'Engineer Agent': 'Reviewed',
  'QA Agent': 'Final',
};

export default function LoadingAnimation() {
  const { processingStep, agentPipeline, agentLogs, activeAgent, agentStories } = useAppStore();
  const terminalRef = useRef(null);
  const storiesRef = useRef(null);
  const hasAgentActivity = agentLogs.length > 0 || activeAgent;
  const [visibleCards, setVisibleCards] = useState(0);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [agentLogs]);

  // Animate story cards appearing one by one
  useEffect(() => {
    if (agentStories.stories.length > 0) {
      setVisibleCards(0);
      const total = agentStories.stories.length;
      let current = 0;
      const timer = setInterval(() => {
        current++;
        setVisibleCards(current);
        if (current >= total) clearInterval(timer);
      }, 200);
      return () => clearInterval(timer);
    } else {
      setVisibleCards(0);
    }
  }, [agentStories.agent, agentStories.stories.length]);

  // Auto-scroll stories container
  useEffect(() => {
    if (storiesRef.current) {
      storiesRef.current.scrollTop = storiesRef.current.scrollHeight;
    }
  }, [visibleCards]);

  // If no agent activity yet, show simple loading
  if (!hasAgentActivity) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
          <Loader2 className="w-20 h-20 text-primary animate-spin relative z-10" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-2xl font-bold text-white tracking-wide">AI is thinking...</h2>
          <p className="text-lg text-secondary animate-pulse font-medium">
            {processingStep || 'Processing...'}
          </p>
        </div>
      </div>
    );
  }

  const currentColors = AGENT_COLORS[agentStories.agent] || AGENT_COLORS['PM Agent'];
  const currentBadge = AGENT_BADGE_LABEL[agentStories.agent] || '';

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/30 blur-md rounded-full" />
            <Bot className="w-8 h-8 text-primary relative z-10" />
          </div>
          Multi-Agent Pipeline
        </h2>
        <p className="text-slate-400">CrewAI agents are collaborating to generate your stories</p>
      </div>

      {/* Main Layout: Pipeline + Terminal + Story Cards */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* Agent Pipeline Sidebar */}
        <div className="col-span-12 lg:col-span-2 flex lg:flex-col flex-row gap-2 overflow-x-auto lg:overflow-visible">
          <h3 className="hidden lg:block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Pipeline</h3>
          {agentPipeline.map((agent, idx) => {
            const Icon = AGENT_ICONS[agent.name] || Bot;
            const colors = AGENT_COLORS[agent.name] || AGENT_COLORS['PM Agent'];
            const isActive = agent.status === 'active';
            const isComplete = agent.status === 'complete';
            
            return (
              <div 
                key={agent.id}
                className={`relative flex items-center gap-2 p-2.5 rounded-xl border transition-all duration-500 min-w-[140px] lg:min-w-0
                  ${isActive 
                    ? `${colors.bg} ${colors.border} shadow-lg ${colors.glow}` 
                    : isComplete 
                      ? 'bg-slate-800/50 border-slate-700' 
                      : 'bg-slate-900/50 border-slate-800 opacity-50'
                  }`}
              >
                {/* Connector line (desktop only) */}
                {idx < agentPipeline.length - 1 && (
                  <div className={`hidden lg:block absolute left-[1.15rem] top-full w-0.5 h-2 z-0
                    ${isComplete ? 'bg-emerald-500/50' : 'bg-slate-700'}`} 
                  />
                )}
                
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                  ${isActive ? colors.bg : isComplete ? 'bg-emerald-500/15' : 'bg-slate-800'}`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : isActive ? (
                    <Icon className={`w-3.5 h-3.5 ${colors.text} animate-pulse`} />
                  ) : (
                    <Icon className="w-3.5 h-3.5 text-slate-600" />
                  )}
                </div>
                
                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-semibold truncate
                    ${isActive ? colors.text : isComplete ? 'text-slate-300' : 'text-slate-600'}`}
                  >
                    {agent.name}
                  </div>
                  <div className={`text-[10px] truncate
                    ${isActive ? 'text-slate-400' : isComplete ? 'text-slate-500' : 'text-slate-700'}`}
                  >
                    {agent.role}
                  </div>
                </div>

                {isActive && <Loader2 className={`w-3.5 h-3.5 ${colors.text} animate-spin flex-shrink-0`} />}
              </div>
            );
          })}
        </div>
        
        {/* Agent Terminal */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl h-full">
            {/* Terminal Header */}
            <div className="bg-slate-800/80 px-3 py-2 border-b border-slate-700 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
              </div>
              <span className="text-[10px] text-slate-400 font-mono ml-1 truncate">
                agent-pipeline — {activeAgent?.agent || 'initializing'}
              </span>
            </div>
            
            {/* Terminal Body */}
            <div 
              ref={terminalRef}
              className="p-3 font-mono text-xs h-[380px] overflow-y-auto custom-scrollbar space-y-0.5"
            >
              {agentLogs.map((log, i) => {
                const colors = AGENT_COLORS[log.agent] || { text: 'text-slate-400' };
                
                if (log.type === 'start') {
                  return (
                    <div key={i} className="flex items-start gap-1.5 py-1">
                      <span className="text-slate-600 select-none">▸</span>
                      <span className={`${colors.text} font-semibold`}>{log.agent}</span>
                      <span className="text-slate-500">—</span>
                      <span className="text-slate-300">{log.text}</span>
                    </div>
                  );
                }
                
                if (log.type === 'thought') {
                  return (
                    <div key={i} className="flex items-start gap-1.5 pl-3">
                      <span className="text-slate-700 select-none">│</span>
                      <span className="text-slate-400">{log.text}</span>
                    </div>
                  );
                }
                
                if (log.type === 'complete') {
                  return (
                    <div key={i} className="flex items-start gap-1.5 py-0.5">
                      <span className="text-emerald-600 select-none">✓</span>
                      <span className="text-emerald-400 font-medium">{log.agent}</span>
                      <span className="text-slate-600">→</span>
                      <span className="text-emerald-300/80">{log.text}</span>
                    </div>
                  );
                }
                
                if (log.type === 'error') {
                  return (
                    <div key={i} className="flex items-start gap-1.5 py-0.5 text-red-400">
                      <span className="select-none">✗</span>
                      <span>{log.text}</span>
                    </div>
                  );
                }
                
                return null;
              })}
              
              {activeAgent && (
                <div className="flex items-center gap-1.5 pl-3 animate-pulse">
                  <span className="text-slate-700 select-none">│</span>
                  <span className={`${AGENT_COLORS[activeAgent.agent]?.text || 'text-primary'}`}>
                    Processing...
                  </span>
                  <span className="inline-block w-1.5 h-3.5 bg-primary/70 animate-[pulse_1s_ease-in-out_infinite]" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Story Cards */}
        <div className="col-span-12 lg:col-span-6">
          <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden h-full">
            {/* Stories Header */}
            <div className="bg-slate-800/60 px-4 py-2.5 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-slate-200">Live Story Preview</span>
              </div>
              {agentStories.agent && (
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${currentColors.badge}`}>
                  {currentBadge} — {agentStories.agent}
                </span>
              )}
            </div>

            {/* Story Cards Container */}
            <div ref={storiesRef} className="p-3 h-[380px] overflow-y-auto custom-scrollbar">
              {agentStories.stories.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-3">
                    <Bot className="w-8 h-8 text-slate-600" />
                  </div>
                  <p className="text-slate-500 text-sm">Stories will appear here as agents create them</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {agentStories.stories.slice(0, visibleCards).map((story, idx) => (
                    <div
                      key={story.id || idx}
                      className="bg-slate-800 border border-slate-700 rounded-lg p-3 animate-in fade-in slide-in-from-bottom-2 duration-300 hover:border-primary/40 transition-colors"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      {/* Card Header */}
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">
                          {story.id}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {story.storyPoints && (
                            <span className="text-[10px] font-bold text-white bg-secondary/80 px-1.5 py-0.5 rounded-full">
                              {story.storyPoints}pt
                            </span>
                          )}
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full 
                            ${story.complexity === 'high' ? 'bg-red-500/20 text-red-400' : 
                              story.complexity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 
                              'bg-green-500/20 text-green-400'}`}
                          >
                            {story.complexity || 'medium'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Title */}
                      <h4 className="text-xs font-semibold text-slate-200 mb-1.5 line-clamp-2 leading-relaxed">
                        {story.title}
                      </h4>
                      
                      {/* Labels */}
                      {story.labels && story.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {story.labels.slice(0, 3).map((label, i) => (
                            <span key={i} className="text-[9px] uppercase font-semibold text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <Tag className="w-2 h-2" /> {label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
