import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import {
  History, X, RefreshCw, Trash2, ExternalLink, CheckCircle2,
  Clock, FileText, Layers, DollarSign, RotateCcw, Search
} from 'lucide-react';
import toast from 'react-hot-toast';

function timeAgo(isoString) {
  const diff = (Date.now() - new Date(isoString)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function SessionHistoryPanel() {
  const {
    isHistoryOpen, setIsHistoryOpen, authToken,
    setEpics, setStories, setKnowledgeGraph, setRepoImpact, setTelemetry,
    setPrdText, setUploadedFileName, setCurrentStep, setGlobalRisks
  } = useAppStore();

  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [restoringId, setRestoringId] = useState(null);

  useEffect(() => {
    if (isHistoryOpen) fetchSessions();
  }, [isHistoryOpen]);

  const authHeaders = {
    'Content-Type': 'application/json',
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
  };

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/sessions', { headers: authHeaders });
      if (res.ok) setSessions(await res.json());
    } catch (e) {
      toast.error('Could not load session history');
    } finally {
      setIsLoading(false);
    }
  };

  const restoreSession = async (sessionId) => {
    setRestoringId(sessionId);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { headers: authHeaders });
      if (!res.ok) throw new Error('Session not found');
      const data = await res.json();

      // Restore full app state from session
      if (data.prd_text) setPrdText(data.prd_text);
      if (data.prd_filename) setUploadedFileName(data.prd_filename);
      if (data.epics?.length) setEpics(data.epics);
      if (data.stories?.length) setStories(data.stories);
      if (data.knowledge_graph) setKnowledgeGraph(data.knowledge_graph);
      if (data.repo_impact) setRepoImpact(data.repo_impact);
      if (data.telemetry) setTelemetry(data.telemetry);

      setCurrentStep('dashboard');
      setIsHistoryOpen(false);
      toast.success(`Restored: "${data.title}"`);
    } catch (e) {
      toast.error('Failed to restore session');
    } finally {
      setRestoringId(null);
    }
  };

  const deleteSession = async (sessionId, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE', headers: authHeaders
      });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        toast.success('Session deleted');
      }
    } catch {
      toast.error('Failed to delete session');
    }
  };

  const filtered = sessions.filter(s =>
    s.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.prd_filename?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isHistoryOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={() => setIsHistoryOpen(false)}
      />

      {/* Slide-in Panel */}
      <div className="fixed left-0 top-0 h-full w-full max-w-md bg-slate-900 border-r border-slate-700/80 z-50 flex flex-col shadow-2xl animate-in slide-in-from-left duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Session History</h2>
              <p className="text-xs text-slate-400">{sessions.length} generation runs saved</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchSessions} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setIsHistoryOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search sessions..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 text-sm text-white rounded-lg focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
            />
          </div>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="text-center py-12 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p className="text-sm">Loading sessions...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-xl">
              <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-slate-400">No sessions yet</p>
              <p className="text-xs mt-1">Generate stories to create your first session</p>
            </div>
          ) : (
            filtered.map(session => (
              <div
                key={session.id}
                onClick={() => restoreSession(session.id)}
                className="group bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-indigo-500/40 rounded-xl p-4 cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="text-sm font-semibold text-white truncate">{session.title}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {session.jira_synced && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" title="Synced to Jira" />
                    )}
                    <button
                      onClick={(e) => deleteSession(session.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-500 hover:text-red-400 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3 text-indigo-400" />
                    {session.total_stories} stories
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-emerald-400" />
                    ${session.total_cost_usd}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {timeAgo(session.created_at)}
                  </span>
                </div>

                {restoringId === session.id && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-indigo-400">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Restoring session...
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
