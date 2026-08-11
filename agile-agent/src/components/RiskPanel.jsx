import { useAppStore } from '../store/appStore';
import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';

export default function RiskPanel() {
  const { globalRisks, epics } = useAppStore();

  const allRisks = [
    ...(globalRisks || []).map(r => ({ text: r, type: 'global' })),
    ...epics.flatMap(e => (e.risks || []).map(r => ({ text: r, type: 'epic', epicName: e.name })))
  ];

  if (!allRisks.length) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-surface/30 border border-slate-700/50 rounded-xl text-center">
        <CheckCircle className="w-12 h-12 text-green-500/50 mb-4" />
        <h3 className="text-xl font-semibold text-slate-200">No Risks Detected</h3>
        <p className="text-slate-400">The PRD seems clear and well-defined.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 mb-4">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="w-6 h-6 text-red-400" />
          <h3 className="text-lg font-bold text-red-100">AI Risk Analysis</h3>
        </div>
        <p className="text-red-200/80 text-sm">
          Our AI has identified the following ambiguous requirements, potential blockers, or missing details from the PRD.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {allRisks.map((risk, i) => (
          <div key={i} className="bg-surface border border-orange-500/20 p-4 rounded-lg flex items-start gap-4">
            <AlertCircle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
            <div>
              {risk.type === 'epic' && (
                <span className="text-xs font-bold text-orange-300 uppercase tracking-wider mb-1 block">
                  Epic: {risk.epicName}
                </span>
              )}
              <p className="text-slate-200">{risk.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
