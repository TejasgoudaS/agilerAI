import React from 'react';
import { Activity, DollarSign, Clock, Zap, Bot, ShieldCheck } from 'lucide-react';

export default function ObservabilityPanel({ telemetry }) {
  if (!telemetry) return null;

  const { totalTokens, promptTokens, completionTokens, totalCostUSD, totalDuration, steps } = telemetry;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          LLM Observability & Cost Telemetry
        </div>
        <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-xs font-medium text-emerald-400 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" /> Live Metrics Tracker
        </span>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Total Tokens
          </div>
          <div className="text-xl font-bold text-white font-mono">{totalTokens ? totalTokens.toLocaleString() : 0}</div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            {promptTokens || 0} in / {completionTokens || 0} out
          </div>
        </div>

        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Est. Cost (USD)
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono">
            ${totalCostUSD ? totalCostUSD.toFixed(4) : '0.0000'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">GPT-4o Tier</div>
        </div>

        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Clock className="w-3.5 h-3.5 text-cyan-400" /> Total Duration
          </div>
          <div className="text-xl font-bold text-white font-mono">{totalDuration || 0}s</div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">End-to-End SSE</div>
        </div>

        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Bot className="w-3.5 h-3.5 text-indigo-400" /> Agent Steps
          </div>
          <div className="text-xl font-bold text-white font-mono">{steps ? steps.length : 0}</div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">CrewAI Sequential</div>
        </div>
      </div>

      {/* Execution Timeline Step Waterfall */}
      {steps && steps.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="text-xs font-medium text-slate-400">Agent Waterfall Latency & Tokens:</div>
          <div className="space-y-1.5">
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-950/50 rounded-lg text-xs border border-slate-800/60 font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                  <span className="text-slate-200 font-medium">{step.agent}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">{step.model}</span>
                </div>
                <div className="flex items-center gap-4 text-slate-400">
                  <span>{step.duration}s</span>
                  <span className="text-amber-300">{step.totalTokens} tokens</span>
                  <span className="text-emerald-400">${step.costUSD}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
