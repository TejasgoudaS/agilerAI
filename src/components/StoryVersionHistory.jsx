import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useShallow } from 'zustand/react/shallow';
import { History, X, GitCommit, ArrowLeftRight, RotateCcw, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StoryVersionHistory() {
  const {
    isVersionHistoryOpen, setIsVersionHistoryOpen,
    activeStoryForHistory, currentSessionId, authToken,
    stories, setStories
  } = useAppStore(useShallow(state => ({
    isVersionHistoryOpen: state.isVersionHistoryOpen,
    setIsVersionHistoryOpen: state.setIsVersionHistoryOpen || (() => {}),
    activeStoryForHistory: state.activeStoryForHistory,
    currentSessionId: state.currentSessionId,
    authToken: state.authToken,
    stories: state.stories,
    setStories: state.setStories
  })));

  const [versions, setVersions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);

  useEffect(() => {
    if (!isVersionHistoryOpen || !activeStoryForHistory) return;

    fetchVersions();
  }, [isVersionHistoryOpen, activeStoryForHistory]);

  const fetchVersions = async () => {
    if (!currentSessionId || !activeStoryForHistory?.id) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/story-versions/${currentSessionId}/${activeStoryForHistory.id}`, {
        headers: { ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) }
      });
      if (res.ok) {
        const data = await res.json();
        setVersions(data);
        if (data.length > 0) setSelectedVersion(data[0]);
      }
    } catch (e) {
      toast.error('Failed to load version history');
    } finally {
      setIsLoading(false);
    }
  };

  const restoreVersion = (versionItem) => {
    if (!versionItem?.snapshot) return;
    const updated = stories.map(s => s.id === activeStoryForHistory.id ? versionItem.snapshot : s);
    setStories(updated);
    toast.success(`Restored Story to Version ${versionItem.version}`);
    setIsVersionHistoryOpen(false);
  };

  if (!isVersionHistoryOpen || !activeStoryForHistory) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-surface/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Story Version History</h3>
              <p className="text-xs text-slate-400">{activeStoryForHistory.id}: {activeStoryForHistory.title}</p>
            </div>
          </div>
          <button
            onClick={() => setIsVersionHistoryOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="grid grid-cols-1 md:grid-cols-3 flex-1 overflow-hidden">
          {/* Version List Sidebar */}
          <div className="border-r border-slate-800 p-4 space-y-2 overflow-y-auto bg-slate-950/40">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Revisions</p>
            {isLoading ? (
              <p className="text-xs text-slate-500 py-4 text-center">Loading revisions...</p>
            ) : versions.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No previous version snapshots saved.</p>
            ) : (
              versions.map((ver) => (
                <button
                  key={ver.version}
                  onClick={() => setSelectedVersion(ver)}
                  className={`w-full text-left p-3 rounded-xl border transition-all text-xs cursor-pointer ${
                    selectedVersion?.version === ver.version
                      ? 'bg-indigo-600/20 border-indigo-500/50 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono font-semibold mb-1">
                    <span className="flex items-center gap-1.5 text-indigo-400">
                      <GitCommit className="w-3.5 h-3.5" /> v{ver.version}
                    </span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1 font-sans">
                      <Clock className="w-3 h-3" /> {new Date(ver.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="line-clamp-1 text-slate-300">{ver.changeSummary || 'Story update'}</p>
                </button>
              ))
            )}
          </div>

          {/* Snapshot Inspector */}
          <div className="md:col-span-2 p-6 overflow-y-auto flex flex-col justify-between space-y-4">
            {selectedVersion ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-xs font-mono text-indigo-400 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                      Version {selectedVersion.version} Snapshot
                    </span>
                    <p className="text-xs text-slate-400 mt-1">{selectedVersion.changeSummary}</p>
                  </div>
                  <button
                    onClick={() => restoreVersion(selectedVersion)}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Restore This Version
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 font-mono text-xs text-slate-300 max-h-96 overflow-y-auto">
                  <div>
                    <span className="text-slate-500">Title:</span> {selectedVersion.snapshot.title}
                  </div>
                  <div>
                    <span className="text-slate-500">Story Points:</span> {selectedVersion.snapshot.storyPoints}
                  </div>
                  <div>
                    <span className="text-slate-500">Complexity:</span> {selectedVersion.snapshot.complexity}
                  </div>
                  <div>
                    <span className="text-slate-500">Description:</span>
                    <p className="text-slate-300 font-sans mt-1 text-xs whitespace-pre-wrap">{selectedVersion.snapshot.description}</p>
                  </div>
                  {selectedVersion.snapshot.acceptanceCriteria && (
                    <div>
                      <span className="text-slate-500">Acceptance Criteria:</span>
                      <ul className="list-disc list-inside font-sans mt-1 space-y-1 text-slate-300">
                        {selectedVersion.snapshot.acceptanceCriteria.map((ac, idx) => (
                          <li key={idx}>{ac}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-sm">
                <ArrowLeftRight className="w-8 h-8 opacity-40 mb-2" />
                Select a version from the left sidebar to inspect and restore.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
