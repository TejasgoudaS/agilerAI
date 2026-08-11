import { useAppStore } from '../store/appStore';
import { User, Tag, Layers } from 'lucide-react';

export default function StoryBoard() {
  const { epics, stories, team } = useAppStore();

  if (!epics.length) return <div className="text-slate-400">No stories generated yet.</div>;

  return (
    <div className="flex flex-col gap-8">
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {epicStories.map(story => {
                const assignee = team.find(t => t.id === story.assigneeId);
                
                return (
                  <div key={story.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-primary/50 transition-colors flex flex-col h-full">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded">
                        {story.id}
                      </span>
                      <span className="text-xs font-bold text-white bg-secondary/80 px-2 py-1 rounded-full">
                        {story.storyPoints} pts
                      </span>
                    </div>
                    
                    <h4 className="font-semibold text-slate-200 mb-2 flex-grow">
                      {story.title}
                    </h4>
                    
                    <div className="flex flex-wrap gap-1 mb-4">
                      {story.labels?.map((label, i) => (
                        <span key={i} className="text-[10px] uppercase font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-sm flex items-center gap-1">
                          <Tag className="w-3 h-3" /> {label}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-700">
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <User className="w-4 h-4" />
                        <span>{assignee ? assignee.name : 'Unassigned'}</span>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full 
                        ${story.complexity === 'high' ? 'bg-red-500/20 text-red-400' : 
                          story.complexity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 
                          'bg-green-500/20 text-green-400'}`}
                      >
                        {story.complexity}
                      </span>
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
