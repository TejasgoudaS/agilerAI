import React from 'react';
import { FileCode, GitBranch, ShieldAlert, ShieldCheck, Cpu, AlertTriangle, Gauge, BadgeCheck } from 'lucide-react';

export default function CodeImpactView({ story, repoImpact }) {
  const affectedFiles = story?.affectedFiles || repoImpact?.affectedFiles || [];
  const locEstimate = story?.locEstimate || repoImpact?.locEstimate || 150;
  const prBreakdown = story?.prBreakdown || repoImpact?.impactSummary || 'Modular Pull Request implementation';
  const risk = story?.complexity || repoImpact?.technicalDebtRisk || 'medium';

  const groundingScore = story?.groundingScore;
  const ungroundedFiles = story?.ungroundedFiles || [];
  const qaScore = story?.qaQualityScore;
  const qaIssues = story?.qaIssues || [];
  const calibrated = story?.calibrationApplied;

  const riskColors = {
    low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    high: 'text-rose-400 bg-rose-500/10 border-rose-500/30'
  };

  const scoreTone = (pct) => {
    if (pct === null || pct === undefined) return 'text-slate-400 bg-slate-800/60 border-slate-700';
    if (pct >= 0.8) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (pct >= 0.5) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3 mt-3">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
          <Cpu className="w-4 h-4 text-indigo-400" />
          Repo Codebase Impact & Grounded Estimates
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${riskColors[risk] || riskColors.medium}`}>
          {risk} Risk Impact
        </span>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/60">
          <span className="text-slate-400 block mb-0.5">LOC Change Estimate</span>
          <span className="text-white font-mono font-semibold text-sm">~{locEstimate} lines</span>
        </div>
        <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/60">
          <span className="text-slate-400 block mb-0.5">Files Touched</span>
          <span className="text-white font-mono font-semibold text-sm">{affectedFiles.length} repository file(s)</span>
        </div>
      </div>

      {/* AI Quality: grounding, QA score, calibration */}
      {(groundingScore !== undefined && groundingScore !== null || qaScore !== undefined || calibrated) && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {groundingScore !== undefined && groundingScore !== null && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium ${scoreTone(groundingScore)}`}
              title={ungroundedFiles.length ? `Unverified: ${ungroundedFiles.join(', ')}` : 'All referenced files verified against the indexed repo'}
            >
              {ungroundedFiles.length > 0 ? <ShieldAlert className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
              Grounding {Math.round(groundingScore * 100)}%
            </span>
          )}
          {qaScore !== undefined && qaScore !== null && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium ${scoreTone(qaScore / 100)}`}
              title={qaIssues.length ? qaIssues.join(' | ') : 'No QA issues flagged'}
            >
              <Gauge className="w-3 h-3" />
              QA {qaScore}/100
            </span>
          )}
          {calibrated && (
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium text-sky-400 bg-sky-500/10 border-sky-500/30"
              title={`Raw AI estimate: ${story.storyPoints} pts, adjusted using historical velocity data`}
            >
              <BadgeCheck className="w-3 h-3" />
              Calibrated {story.calibratedStoryPoints} pts
            </span>
          )}
        </div>
      )}

      {/* Affected Files List */}
      {affectedFiles.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5 text-indigo-400" /> Target File Paths:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {affectedFiles.map((filePath, i) => {
              const isUngrounded = ungroundedFiles.includes(filePath);
              return (
                <code
                  key={i}
                  title={isUngrounded ? 'Not found in the indexed repository — possibly hallucinated' : 'Verified against the indexed repository'}
                  className={`px-2 py-1 rounded text-[11px] font-mono truncate max-w-full border flex items-center gap-1 ${
                    isUngrounded
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                      : 'bg-slate-950 border-slate-800 text-cyan-300'
                  }`}
                >
                  {isUngrounded && <AlertTriangle className="w-3 h-3 shrink-0" />}
                  {filePath}
                </code>
              );
            })}
          </div>
        </div>
      )}

      {/* PR Strategy Recommendation */}
      {prBreakdown && (
        <div className="pt-2 border-t border-slate-800/60 flex items-start gap-2 text-xs text-slate-400">
          <GitBranch className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-slate-300">Suggested PR Strategy:</strong> {prBreakdown}
          </div>
        </div>
      )}
    </div>
  );
}
