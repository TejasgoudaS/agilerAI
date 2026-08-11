import React from 'react';
import { useAppStore } from '../store/appStore';
import { User, Tag, Layers, FileCode, Sparkles, Terminal, History } from 'lucide-react';
import CodeImpactView from './CodeImpactView';
import ObservabilityPanel from './ObservabilityPanel';
import StoryRatingWidget from './StoryRatingWidget';

export default function StoryBoard() {
  const { 
    epics, stories, team, repoImpact, telemetry, 
    setSelectedStoryForTest, setIsTestModalOpen,
    setActiveStoryForHistory, setIsVersionHistoryOpen
  } = useAppStore();

  if (!epics.length) return <div className="text-slate-400">No stories generated yet.</div>;

  return (
    <div className="flex flex-col gap-8">
      {/* Real-time LLM Observability Metrics Panel */}
      {telemetry && <ObservabilityPanel telemetry={telemetry} />}

      {/* Epics & Story Cards */}
      {epics.map(epic => {
        const epicStories = stories.filter(s => s.epicId === epic.id);
        
        return (
          <div key={epic.id} className="bg-surface/50 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-700 pb-4">
              <div className="bg-primary/20 text-primary p-2 rounded-lg">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-100">{epic.name}</h3>
                <p className="text-slate-400 text-sm">{epic.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {epicStories.map(story => {
                const assignee = team.find(t => t.id === story.assigneeId);
                
                return (
                  <div key={story.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-primary/50 transition-all flex flex-col justify-between shadow-lg">
                    <div>
                      {/* Card Header */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-300 bg-slate-900 px-2.5 py-1 rounded border border-slate-700">
                            {story.id}
                          </span>
                          <span className="text-xs font-semibold uppercase text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded">
                            {story.type || 'feature'}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 px-3 py-1 rounded-full shadow">
                          {story.storyPoints} Story Pts
                        </span>
                      </div>
                      
                      <h4 className="font-semibold text-slate-100 text-base mb-2">
                        {story.title}
                      </h4>
                      
                      <p className="text-xs text-slate-400 mb-3 line-clamp-2">
                        {story.description}
                      </p>

                      {/* Labels */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {story.labels?.map((label, i) => (
                          <span key={i} className="text-[10px] uppercase font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Tag className="w-3 h-3" /> {label}
                          </span>
                        ))}
                      </div>

                      {/* Codebase Impact & Grounded Estimator */}
                      <CodeImpactView story={story} repoImpact={repoImpact} />

                      {/* Story Rating Widget (Phase 4 Feedback) */}
                      <div className="mt-3 pt-2 border-t border-slate-800">
                        <StoryRatingWidget storyTitle={story.title} />
                      </div>
                    </div>

                    {/* Footer Actions & Assignee */}
                    <div className="mt-4 pt-3 border-t border-slate-700/80 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <User className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{assignee ? assignee.name : 'Unassigned'}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setActiveStoryForHistory(story);
                            setIsVersionHistoryOpen(true);
                          }}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
                          title="View version history"
                        >
                          <History className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="hidden sm:inline">History</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedStoryForTest(story);
                            setIsTestModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Terminal className="w-3.5 h-3.5 text-purple-400" />
                          Generate Test Suite
                        </button>

                        <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full capitalize ${
                          story.complexity === 'high' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                          story.complexity === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 
                          'bg-green-500/20 text-green-400 border border-green-500/30'
                        }`}>
                          {story.complexity}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
