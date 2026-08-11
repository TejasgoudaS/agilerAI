import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import {
  BarChart2, DollarSign, Zap, Layers, TrendingUp, TrendingDown,
  Minus, RefreshCw, GitCommit, Award, Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import VelocityBenchmark from './VelocityBenchmark';

function StatCard({ icon: Icon, label, value, sub, color = 'indigo' }) {
  const colors = {
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  };
  return (
    <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg border ${colors[color]} shrink-0`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function CostTrendBar({ trend = [] }) {
  if (!trend.length) return null;
  const max = Math.max(...trend.map(t => t.cost), 0.001);
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Cost Trend (Last 10 Sessions)</p>
      <div className="flex items-end gap-1.5 h-20">
        {trend.map((item, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
            <div
              className="w-full bg-indigo-500/60 group-hover:bg-indigo-400/80 rounded-t transition-all"
              style={{ height: `${(item.cost / max) * 64}px`, minHeight: '2px' }}
              title={`$${item.cost} — ${item.stories} stories`}
            />
            <span className="text-[9px] text-slate-500 truncate w-full text-center">{item.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { authToken, jiraBoards } = useAppStore();
  const [usage, setUsage] = useState(null);
  const [velocity, setVelocity] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVelocityLoading, setIsVelocityLoading] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState('');

  const authHeaders = { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) };

  useEffect(() => { fetchUsage(); }, []);

  const fetchUsage = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/analytics/usage', { headers: authHeaders });
      if (res.ok) setUsage(await res.json());
    } catch { } finally { setIsLoading(false); }
  };

  const fetchVelocity = async () => {
    if (!selectedBoardId) { toast.error('Select a Jira board first'); return; }
    setIsVelocityLoading(true);
    try {
      const res = await fetch(`/api/analytics/velocity?board_id=${selectedBoardId}`, { headers: authHeaders });
      if (res.ok) setVelocity(await res.json());
      else toast.error('Could not load velocity data');
    } catch { toast.error('Velocity fetch failed'); } finally { setIsVelocityLoading(false); }
  };

  const TrendIcon = velocity?.trend === 'improving' ? TrendingUp : velocity?.trend === 'stable' ? Minus : TrendingDown;
  const trendColor = velocity?.trend === 'improving' ? 'text-emerald-400' : velocity?.trend === 'stable' ? 'text-amber-400' : 'text-slate-400';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Analytics & Velocity</h2>
          <p className="text-sm text-slate-400">AI generation cost, token usage, and sprint performance benchmarks</p>
        </div>
        <button onClick={fetchUsage} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Usage Stats */}
      {isLoading ? (
        <div className="text-center py-8 text-slate-400 text-sm">Loading analytics...</div>
      ) : usage ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Activity} label="Total Sessions" value={usage.totalSessions} color="indigo" />
            <StatCard icon={DollarSign} label="Total AI Cost" value={`$${usage.totalCostUSD}`} sub={`Avg $${usage.avgCostPerSession}/session`} color="emerald" />
            <StatCard icon={Layers} label="Stories Generated" value={usage.totalStories} sub={`${usage.avgStoriesPerSession} per session avg`} color="amber" />
            <StatCard icon={Zap} label="Total Tokens" value={usage.totalTokens?.toLocaleString()} sub={`${usage.promptTokens?.toLocaleString()} prompt`} color="cyan" />
          </div>

          <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-5">
            <CostTrendBar trend={usage.costTrend} />
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-xl">
          <BarChart2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No analytics data yet. Generate stories to see usage metrics.</p>
        </div>
      )}

      {/* Velocity Benchmarking */}
      <div className="bg-slate-900 border border-slate-700/60 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-white text-sm">Sprint Velocity Benchmark</span>
            <span className="text-xs text-slate-500 px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400">AI vs Actual</span>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-3">
            <select
              value={selectedBoardId}
              onChange={e => setSelectedBoardId(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 text-sm text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="">Select Jira Board...</option>
              {jiraBoards?.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <button
              onClick={fetchVelocity}
              disabled={!selectedBoardId || isVelocityLoading}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {isVelocityLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
              Analyze
            </button>
          </div>

          {velocity && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <VelocityBenchmark velocity={velocity} />

              {/* Summary Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-950 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-white">{velocity.averageVelocity}</p>
                  <p className="text-xs text-slate-400">Avg Velocity (pts/sprint)</p>
                </div>
                <div className="bg-slate-950 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-white">{velocity.averageCompletionRate}%</p>
                  <p className="text-xs text-slate-400">Avg Sprint Completion</p>
                </div>
                <div className="bg-slate-950 rounded-xl p-3 text-center flex flex-col items-center">
                  <TrendIcon className={`w-6 h-6 ${trendColor} mb-0.5`} />
                  <p className="text-xs text-slate-400 capitalize">{velocity.trend}</p>
                </div>
              </div>

              {/* Sprint Table */}
              {velocity.sprints?.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-950/80">
                      <tr>
                        {['Sprint', 'Committed', 'Completed', 'Rate', 'Period'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {velocity.sprints.map(sprint => (
                        <tr key={sprint.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3 text-slate-200 font-medium">{sprint.name}</td>
                          <td className="px-4 py-3 text-slate-300">{sprint.committed} pts</td>
                          <td className="px-4 py-3 text-emerald-400 font-medium">{sprint.completed} pts</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sprint.completionRate >= 80 ? 'bg-emerald-500/10 text-emerald-400' : sprint.completionRate >= 60 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
                              {sprint.completionRate}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{sprint.startDate} → {sprint.endDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {!velocity && !isVelocityLoading && (
            <p className="text-center text-sm text-slate-500 py-4">
              Select a Jira board to see how AI story points compare to actual sprint velocity
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
