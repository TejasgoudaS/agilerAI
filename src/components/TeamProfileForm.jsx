import { useAppStore } from '../store/appStore';
import { Users } from 'lucide-react';

export default function TeamProfileForm() {
  const { team, selectedProject, updateTeamMemberSeniority } = useAppStore();

  return (
    <div className="bg-surface p-6 rounded-2xl border border-slate-700 w-full max-w-2xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
          <Users className="w-5 h-5 text-secondary" />
          Project Team
        </h3>
        <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-md">
          {team.length} Assignable Users
        </span>
      </div>
      
      {!selectedProject ? (
        <p className="text-slate-400 text-sm italic">Select a Jira Project below to load team members.</p>
      ) : (
        <div className="flex flex-wrap gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          {team.map(member => (
            <div key={member.id} className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex flex-col gap-2 relative group min-w-[150px]">
              <div>
                <div className="font-semibold text-slate-200 text-sm truncate">{member.name}</div>
                <div className="text-xs text-slate-400 truncate">Jira User</div>
              </div>
              <select
                value={member.seniority || 'mid'}
                onChange={(e) => updateTeamMemberSeniority(member.id, e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-primary"
              >
                <option value="junior">Junior</option>
                <option value="mid">Mid-level</option>
                <option value="senior">Senior</option>
              </select>
            </div>
          ))}
          {team.length === 0 && (
            <p className="text-slate-400 text-sm italic">No assignable users found for this project.</p>
          )}
        </div>
      )}
    </div>
  );
}
