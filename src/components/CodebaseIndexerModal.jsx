import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { FolderGit2, X, Cpu, CheckCircle2, Code2, Database, FileCode, Search, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CodebaseIndexerModal() {
  const { isIndexerOpen, setIsIndexerOpen, codebaseStats, setCodebaseStats } = useAppStore();
  const [pathInput, setPathInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Fetch current status on load
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/codebase/status');
      if (res.ok) {
        const data = await res.json();
        if (data.fileCount > 0) {
          setCodebaseStats(data);
          if (!pathInput) setPathInput(data.path || '');
        }
      }
    } catch (e) {
      console.warn("Status fetch warning:", e);
    }
  };

  const handleIndex = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/codebase/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dirPath: pathInput.trim() || undefined })
      });
      const data = await res.json();
      if (res.ok) {
        setCodebaseStats(data);
        toast.success(`Successfully indexed ${data.fileCount} files in codebase!`);
      } else {
        toast.error(data.detail || "Failed to index directory");
      }
    } catch (e) {
      toast.error("Error connecting to codebase indexer");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isIndexerOpen) return null;

  const stats = codebaseStats?.stats;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
              <FolderGit2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Codebase RAG Vector Indexer</h2>
              <p className="text-sm text-slate-400">Index local code repositories for context-grounded story points & file diffs</p>
            </div>
          </div>
          <button 
            onClick={() => setIsIndexerOpen(false)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Path Input Form */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Local Repository Directory Path</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-500" />
                <input
                  type="text"
                  value={pathInput}
                  onChange={(e) => setPathInput(e.target.value)}
                  placeholder="e.g. C:/Projects/my-app or ./ (Leave empty for workspace default)"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                />
              </div>
              <button
                onClick={handleIndex}
                disabled={isLoading}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-medium rounded-xl text-sm flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-200" />
                    Scanning AST...
                  </>
                ) : (
                  <>
                    <Cpu className="w-4 h-4" />
                    Index Codebase
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Scans JS/TS, Python, Java, Go, SQL & CSS files. Ignores <code className="text-indigo-400">node_modules</code>, <code className="text-indigo-400">.git</code>, and build folders.
            </p>
          </div>

          {/* Stats Display */}
          {codebaseStats ? (
            <div className="space-y-4 border-t border-slate-800 pt-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Active Index Status
                </span>
                <span className="text-xs font-mono text-slate-400 truncate max-w-[350px]">
                  {codebaseStats.path}
                </span>
              </div>

              {/* Stat Grid Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                    <FileCode className="w-3.5 h-3.5 text-indigo-400" /> Total Files
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">{codebaseStats.fileCount || 0}</div>
                </div>

                <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                    <Code2 className="w-3.5 h-3.5 text-cyan-400" /> Lines of Code
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">
                    {stats?.total_lines ? stats.total_lines.toLocaleString() : 0}
                  </div>
                </div>

                <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                    <Database className="w-3.5 h-3.5 text-purple-400" /> API Endpoints
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">
                    {stats?.api_routes?.length || 0}
                  </div>
                </div>
              </div>

              {/* Language Breakdown Pills */}
              {stats?.languages && Object.keys(stats.languages).length > 0 && (
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-medium text-slate-400">Language Distribution</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.languages).map(([lang, count]) => (
                      <span 
                        key={lang} 
                        className="px-3 py-1 bg-slate-800/80 border border-slate-700/60 rounded-lg text-xs text-slate-200 flex items-center gap-2 font-mono"
                      >
                        <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                        {lang}: <strong className="text-white">{count}</strong> files
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/30 text-slate-400">
              <FolderGit2 className="w-10 h-10 mx-auto mb-3 text-slate-600" />
              <p className="text-sm font-medium text-slate-300">No codebase indexed yet</p>
              <p className="text-xs text-slate-500 mt-1">Click "Index Codebase" above to scan your current workspace for RAG story point estimation.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={() => setIsIndexerOpen(false)}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
