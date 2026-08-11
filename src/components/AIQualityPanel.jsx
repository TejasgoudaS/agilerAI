import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import {
  ShieldCheck, ShieldAlert, Gauge, RefreshCw, FlaskConical, BadgeCheck,
  CheckCircle2, XCircle, Save, Loader2, TrendingUp, TrendingDown, Minus
} from 'lucide-react';
import toast from 'react-hot-toast';

function StatCard({ icon: Icon, label, value, sub, color = 'indigo' }) {
  const colors = {
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
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

function RubricBar({ label, value }) {
  if (value === null || value === undefined) return null;
  const pct = Math.min(100, Math.max(0, (value / 5) * 100));
  const tone = value >= 4 ? 'bg-emerald-500' : value >= 2.5 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300 capitalize">{label.replace(/([A-Z])/g, ' $1')}</span>
        <span className="font-mono text-slate-200">{value.toFixed(2)} / 5</span>
      </div>
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${tone} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AIQualityPanel() {
  const {
    authToken, jiraBoards, qualityReport, groundingSummary, reflectionApplied,
    calibrationStatus, setCalibrationStatus,
  } = useAppStore();

  const [isCalibrating, setIsCalibrating] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [evalReport, setEvalReport] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSavingBaseline, setIsSavingBaseline] = useState(false);

  const authHeaders = { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) };

  useEffect(() => { fetchCalibrationStatus(); }, []);

  const fetchCalibrationStatus = async () => {
    try {
      const res = await fetch('/api/analytics/velocity/calibration-status', { headers: authHeaders });
      if (res.ok) setCalibrationStatus(await res.json());
    } catch { /* silent — status widget just stays empty */ }
  };

  const trainCalibrator = async () => {
    if (!selectedBoardId) { toast.error('Select a Jira board first'); return; }
    setIsCalibrating(true);
    try {
      const res = await fetch(`/api/analytics/velocity/calibrate?board_id=${selectedBoardId}`, { method: 'POST', headers: authHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Calibration failed');
      if (data.trained) {
        toast.success(`Calibrator trained on ${data.samples} matched stories (R²=${data.r2})`);
      } else {
        toast(data.reason || 'Not enough matched history yet', { icon: 'ℹ️' });
      }
      fetchCalibrationStatus();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setIsCalibrating(false);
    }
  };

  const runEval = async () => {
    setIsEvaluating(true);
    try {
      const res = await fetch('/api/eval/run', { method: 'POST', headers: authHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Eval run failed');
      setEvalReport(data);
      toast.success(`Eval complete — ${data.totalStoriesJudged} stories judged across ${data.goldenCount} golden PRDs`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setIsEvaluating(false);
    }
  };

  const saveBaseline = async () => {
    if (!evalReport) return;
    setIsSavingBaseline(true);
    try {
      const res = await fetch('/api/eval/save-baseline', {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ aggregate: evalReport.aggregate }),
      });
      if (!res.ok) throw new Error('Failed to save baseline');
      toast.success('Saved as new regression baseline');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setIsSavingBaseline(false);
    }
  };

  const regression = evalReport?.regression;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-400" /> AI Quality
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Grounding guardrail, QA audit, velocity calibration, and the LLM-as-judge eval harness — the machinery that
          keeps the agent pipeline honest, not just fast.
        </p>
      </div>

      {/* Last Run: QA + Grounding + Reflection */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Last Pipeline Run</p>
        {!qualityReport && !groundingSummary ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center text-sm text-slate-500">
            Generate stories from a PRD to see QA and grounding results here.
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon={Gauge}
              label="QA Quality Score"
              value={qualityReport?.overallQualityScore ?? '—'}
              sub="/ 100, audited by QA Agent"
              color={qualityReport?.overallQualityScore >= 75 ? 'emerald' : 'amber'}
            />
            <StatCard
              icon={qualityReport?.readyForSprint ? CheckCircle2 : XCircle}
              label="Ready For Sprint"
              value={qualityReport?.readyForSprint ? 'Yes' : 'No'}
              color={qualityReport?.readyForSprint ? 'emerald' : 'rose'}
            />
            <StatCard
              icon={groundingSummary?.storiesWithHallucinatedFiles > 0 ? ShieldAlert : ShieldCheck}
              label="Grounding Score"
              value={groundingSummary?.averageGroundingScore != null ? `${Math.round(groundingSummary.averageGroundingScore * 100)}%` : '—'}
              sub={groundingSummary?.storiesWithHallucinatedFiles
                ? `${groundingSummary.storiesWithHallucinatedFiles} stor${groundingSummary.storiesWithHallucinatedFiles === 1 ? 'y references' : 'ies reference'} unverified files`
                : 'All referenced files verified'}
              color={groundingSummary?.storiesWithHallucinatedFiles > 0 ? 'rose' : 'emerald'}
            />
            <StatCard
              icon={RefreshCw}
              label="Reflection Pass"
              value={reflectionApplied ? 'Applied' : 'Not needed'}
              sub={reflectionApplied ? 'QA score triggered 1 revision' : 'First draft passed threshold'}
              color={reflectionApplied ? 'sky' : 'indigo'}
            />
          </div>
        )}
      </div>

      {/* Velocity Calibrator */}
      <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-sky-400" />
            <p className="text-sm font-semibold text-white">Velocity Calibrator</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
            calibrationStatus?.trained
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
              : 'text-slate-400 bg-slate-800/60 border-slate-700'
          }`}>
            {calibrationStatus?.trained ? 'Trained' : 'Untrained (cold start)'}
          </span>
        </div>
        <p className="text-xs text-slate-400">
          A Ridge regression learns the systematic bias between the AI's initial story-point estimate and your team's
          actual Jira points. Needs at least {calibrationStatus?.minSamplesRequired ?? 5} matched historical stories —
          until then, every estimate is returned uncalibrated.
        </p>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/60">
            <span className="text-slate-400 block mb-0.5">Trained On</span>
            <span className="text-white font-mono font-semibold">{calibrationStatus?.trainedOn ?? 0} samples</span>
          </div>
          <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/60">
            <span className="text-slate-400 block mb-0.5">R² (fit quality)</span>
            <span className="text-white font-mono font-semibold">{calibrationStatus?.r2 ?? '—'}</span>
          </div>
          <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/60">
            <span className="text-slate-400 block mb-0.5">Min Samples Required</span>
            <span className="text-white font-mono font-semibold">{calibrationStatus?.minSamplesRequired ?? 5}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <select
            value={selectedBoardId}
            onChange={e => setSelectedBoardId(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 text-sm text-white rounded-lg focus:outline-none focus:border-indigo-500"
          >
            <option value="">Select Jira board...</option>
            {jiraBoards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button
            onClick={trainCalibrator}
            disabled={isCalibrating}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 rounded-lg text-sm font-medium transition-all disabled:opacity-50 cursor-pointer"
          >
            {isCalibrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Train from Jira History
          </button>
        </div>
      </div>

      {/* Eval Harness */}
      <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-purple-400" />
            <p className="text-sm font-semibold text-white">LLM-as-Judge Eval Harness</p>
          </div>
          <div className="flex items-center gap-2">
            {evalReport && (
              <button
                onClick={saveBaseline}
                disabled={isSavingBaseline}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSavingBaseline ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save as Baseline
              </button>
            )}
            <button
              onClick={runEval}
              disabled={isEvaluating}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 rounded-lg text-sm font-medium transition-all disabled:opacity-50 cursor-pointer"
            >
              {isEvaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
              {isEvaluating ? 'Running...' : 'Run Eval'}
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Runs 3 fixed golden PRDs through the real PM + Engineer agents, scores every story on a 1-5 rubric (a cheap
          judge model for clarity/testability/sizing, plus the deterministic groundingScore for "grounded"), and
          diffs the result against the last saved baseline to catch prompt regressions numerically.
        </p>

        {evalReport && (
          <div className="space-y-4 pt-2 border-t border-slate-800">
            {regression && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${
                !regression.baselineExists
                  ? 'text-slate-400 bg-slate-800/60 border-slate-700'
                  : regression.regressed
                  ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                  : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
              }`}>
                {!regression.baselineExists ? <Minus className="w-3.5 h-3.5" /> :
                  regression.regressed ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                {!regression.baselineExists
                  ? 'No baseline saved yet — this run will be the reference once saved.'
                  : regression.regressed
                  ? `Regression detected (threshold ${regression.threshold} pts): ${JSON.stringify(regression.deltas)}`
                  : `No regression vs baseline: ${JSON.stringify(regression.deltas)}`}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
              {Object.entries(evalReport.aggregate).map(([dim, val]) => (
                <RubricBar key={dim} label={dim} value={val} />
              ))}
            </div>

            <div className="space-y-1.5 pt-1">
              <p className="text-xs font-medium text-slate-400">Per Golden PRD:</p>
              {evalReport.perPrd.map(p => (
                <div key={p.id} className="flex items-center justify-between p-2.5 bg-slate-950/50 rounded-lg text-xs border border-slate-800/60">
                  <span className="text-slate-200 font-mono">{p.id}</span>
                  <span className="text-slate-400">{p.storiesJudged} stories judged · overall {p.average.overall ?? '—'}/5</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
