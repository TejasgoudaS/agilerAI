import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { Settings, RefreshCw } from 'lucide-react';
import { getProjects, getBoards, getSprints, getAssignableUsers } from '../lib/jiraClient';
import toast from 'react-hot-toast';

export default function JiraConfigForm() {
  const { 
    jiraProjects, setJiraProjects, 
    jiraBoards, setJiraBoards, 
    jiraSprints, setJiraSprints,
    selectedProject, setSelectedProject,
    selectedBoard, setSelectedBoard,
    selectedSprint, setSelectedSprint,
    setTeam
  } = useAppStore();

  useEffect(() => {
    async function loadProjects() {
      const projects = await getProjects();
      setJiraProjects(projects);
      if (projects.length > 0 && !selectedProject) {
        // Find if they had a default project in env and select it
        const envProj = import.meta.env.VITE_JIRA_PROJECT_KEY;
        const match = projects.find(p => p.key === envProj);
        setSelectedProject(match || projects[0]);
      }
    }
    loadProjects();
  }, []);

  useEffect(() => {
    async function loadBoardAndUsers() {
      if (!selectedProject) return;
      
      const [boards, users] = await Promise.all([
        getBoards(selectedProject.key),
        getAssignableUsers(selectedProject.key)
      ]);
      
      setJiraBoards(boards);
      if (boards.length > 0) setSelectedBoard(boards[0]);
      else setSelectedBoard(null);

      // Transform Jira users into our team format
      const formattedTeam = users.map(u => ({
        id: u.accountId,
        name: u.displayName,
        role: 'developer', // Default role
        seniority: 'mid', // Default seniority
        skills: [],
        currentLoad: 0
      }));
      setTeam(formattedTeam);
    }
    loadBoardAndUsers();
  }, [selectedProject]);

  useEffect(() => {
    async function loadSprints() {
      if (!selectedBoard) {
        setJiraSprints([]);
        setSelectedSprint(null);
        return;
      }
      
      const sprints = await getSprints(selectedBoard.id);
      setJiraSprints(sprints);
      setSelectedSprint('backlog'); // Default to backlog
    }
    loadSprints();
  }, [selectedBoard]);

  return (
    <div className="bg-surface p-6 rounded-2xl border border-slate-700 w-full max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          Jira Destination
        </h3>
        <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-md">
          Auto-synced
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Project</label>
          <select
            value={selectedProject?.key || ''}
            onChange={e => setSelectedProject(jiraProjects.find(p => p.key === e.target.value))}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-primary"
            disabled={jiraProjects.length === 0}
          >
            {jiraProjects.length === 0 && <option value="">Loading...</option>}
            {jiraProjects.map(p => (
              <option key={p.id} value={p.key}>{p.name} ({p.key})</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Board</label>
          <select
            value={selectedBoard?.id || ''}
            onChange={e => setSelectedBoard(jiraBoards.find(b => b.id.toString() === e.target.value))}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-primary"
            disabled={jiraBoards.length === 0}
          >
            {jiraBoards.length === 0 && <option value="">No Boards Found</option>}
            {jiraBoards.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Target Sprint</label>
          <select
            value={selectedSprint || 'backlog'}
            onChange={e => setSelectedSprint(e.target.value === 'backlog' ? 'backlog' : e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-primary"
            disabled={!selectedBoard}
          >
            <option value="backlog">Backlog</option>
            {jiraSprints.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.state})</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
