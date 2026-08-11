import { useAppStore } from '../store/appStore';
import { Calendar, CheckCircle } from 'lucide-react';

export default function SprintPlanView() {
  const { sprints, team } = useAppStore();

  if (!sprints.length) return <div className="text-slate-400">No sprints planned yet.</div>;

  return (
    <div className="flex flex-col gap-6">
      {sprints.map((sprint, idx) => (
        <div key={idx} className="bg-surface border border-slate-700 rounded-xl overflow-hidden">
          <div className="bg-slate-800/80 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-secondary" />
              <h3 className="text-lg font-bold text-white">Sprint {sprint.sprintNumber}</h3>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-400 font-medium">
                {sprint.stories.length} Stories
              </span>
              <span className="text-sm font-bold bg-primary/20 text-primary px-3 py-1 rounded-full">
                {sprint.totalPoints} pts
              </span>
            </div>
          </div>
          
          <div className="p-6">
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Team Capacity</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(sprint.developerLoad || {}).map(([devName, load]) => {
                  const percentage = Math.min(100, (load / 20) * 100);
                  const isOverloaded = load > 20;
                  
                  return (
                    <div key={devName} className="bg-slate-900 rounded-lg p-3 border border-slate-800">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-slate-200">{devName}</span>
                        <span className={`text-xs font-bold ${isOverloaded ? 'text-red-400' : 'text-slate-400'}`}>
                          {load}/20 pts
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${isOverloaded ? 'bg-red-500' : percentage > 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Sprint Backlog</h4>
              <div className="flex flex-wrap gap-2">
                {sprint.stories.map((storyId, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-2 rounded-md text-sm">
                    <CheckCircle className="w-4 h-4 text-slate-500" />
                    <span className="font-mono text-slate-300">{storyId}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
