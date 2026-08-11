import React from 'react';
import { TrendingUp, Award, Zap, AlertCircle } from 'lucide-react';

export default function VelocityBenchmark({ velocity }) {
  if (!velocity) return null;

  const { averageVelocity, averageCompletionRate, trend, sprints = [] } = velocity;

  return (
    <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold text-white text-base">AI Story Point Accuracy & Velocity Benchmark</h3>
        </div>
        <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-xs font-semibold">
          {averageCompletionRate >= 85 ? 'High Accuracy' : averageCompletionRate >= 70 ? 'Moderate Calibration' : 'Recalibration Recommended'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Avg Velocity</span>
          <p className="text-3xl font-extrabold text-white my-1">{averageVelocity} <span className="text-sm font-normal text-slate-400">pts/sprint</span></p>
          <p className="text-[11px] text-slate-500">Historical sprint throughput</p>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Sprint Completion Rate</span>
          <p className="text-3xl font-extrabold text-emerald-400 my-1">{averageCompletionRate}%</p>
          <p className="text-[11px] text-slate-500">Actual vs committed story points</p>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Velocity Trend</span>
          <p className="text-2xl font-extrabold text-indigo-300 capitalize my-1 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-400" /> {trend}
          </p>
          <p className="text-[11px] text-slate-500">Velocity trajectory across sprints</p>
        </div>
      </div>

      {sprints.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sprint Velocity Comparison</p>
          <div className="space-y-3">
            {sprints.map((s) => (
              <div key={s.id} className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-200">{s.name}</span>
                  <span className="text-slate-400">{s.completed} / {s.committed} pts ({s.completionRate}%)</span>
                </div>
                <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden flex border border-slate-800">
                  <div
                    className="bg-indigo-500 h-full transition-all"
                    style={{ width: `${Math.min(100, (s.completed / Math.max(1, s.committed)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
