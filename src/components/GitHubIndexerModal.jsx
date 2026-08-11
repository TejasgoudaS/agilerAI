import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { X, Search, Loader2, GitBranch, Star, GitFork, CheckCircle2, FileCode2, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

const GithubIcon = (props) => (
  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export default function GitHubIndexerModal() {
  const { isGitHubIndexerOpen, setIsGitHubIndexerOpen, authToken, setCodebaseStats } = useAppStore();
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [isIndexing, setIsIndexing] = useState(false);
  const [result, setResult] = useState(null);

  const authHeaders = { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) };

  const handleIndex = async () => {
    if (!url.trim()) return;
    setIsIndexing(true);
    setResult(null);
    try {
      const res = await fetch('/api/integrations/github/index', {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ github_url: url, github_token: token || undefined })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Indexing failed');
      setResult(data.stats);
      setCodebaseStats({ ...data.stats, source: 'github' });
      toast.success(`Indexed ${data.stats.fileCount} files from ${data.stats.repo}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setIsIndexing(false);
    }
  };

  if (!isGitHubIndexerOpen) return null;

  const langColors = { '.py': '#3b82f6', '.js': '#eab308', '.ts': '#06b6d4', '.tsx': '#8b5cf6', '.jsx': '#f59e0b', '.java': '#ef4444', '.go': '#10b981' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 border border-slate-700 rounded-xl">
              <GithubIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">GitHub Repo Indexer</h2>
              <p className="text-xs text-slate-400">Index any repo directly via GitHub API</p>
            </div>
          </div>
          <button onClick={() => setIsGitHubIndexerOpen(false)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* URL Input */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">Repository URL</label>
            <div className="relative">
              <GithubIcon className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 text-sm text-white rounded-xl focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                onKeyDown={e => e.key === 'Enter' && handleIndex()}
              />
            </div>
          </div>

          {/* GitHub Token (optional for private repos) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              Personal Access Token <span className="text-slate-500 font-normal">(optional, for private repos)</span>
            </label>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 text-sm text-white rounded-xl focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 font-mono"
            />
          </div>

          <button
            onClick={handleIndex}
            disabled={!url.trim() || isIndexing}
            className="w-full py-3 bg-gradient-to-r from-slate-700 to-slate-600 hover:from-indigo-700 hover:to-indigo-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isIndexing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {isIndexing ? 'Indexing repository...' : 'Index Repository'}
          </button>

          {/* Results */}
          {result && (
            <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-4 space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Successfully indexed {result.owner}/{result.repo}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-900 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-white">{result.fileCount}</p>
                  <p className="text-xs text-slate-400">Files</p>
                </div>
                <div className="bg-slate-900 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-yellow-400 flex items-center justify-center gap-1">
                    <Star className="w-3.5 h-3.5" />{result.stars || 0}
                  </p>
                  <p className="text-xs text-slate-400">Stars</p>
                </div>
                <div className="bg-slate-900 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-indigo-400 flex items-center justify-center gap-1">
                    <GitFork className="w-3.5 h-3.5" />{result.forks || 0}
                  </p>
                  <p className="text-xs text-slate-400">Forks</p>
                </div>
              </div>

              {result.description && (
                <p className="text-xs text-slate-400 italic">"{result.description}"</p>
              )}

              {result.languages && Object.keys(result.languages).length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Language Distribution</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(result.languages).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([ext, count]) => (
                      <span key={ext} className="px-2 py-0.5 rounded-full text-xs font-mono" style={{ background: (langColors[ext] || '#6b7280') + '20', color: langColors[ext] || '#9ca3af', border: `1px solid ${(langColors[ext] || '#6b7280')}40` }}>
                        {ext} ({count})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.topics && result.topics.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {result.topics.map(t => (
                    <span key={t} className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-xs">{t}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
