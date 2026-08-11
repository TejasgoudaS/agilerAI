import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useShallow } from 'zustand/react/shallow';
import { Loader2, CheckCircle2, AlertTriangle, X, RefreshCw } from 'lucide-react';

export default function JobStatusBanner() {
  const { currentJobId, setCurrentJobId, authToken } = useAppStore(useShallow(state => ({
    currentJobId: state.currentJobId,
    setCurrentJobId: state.setCurrentJobId || (() => {}),
    authToken: state.authToken
  })));

  const [job, setJob] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!currentJobId) return;

    setDismissed(false);
    let intervalId = null;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/jobs/${currentJobId}`, {
          headers: { ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) }
        });
        if (res.ok) {
          const data = await res.json();
          setJob(data);
          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(intervalId);
          }
        }
      } catch (e) {
        console.warn('Error checking job status:', e);
      }
    };

    checkStatus();
    intervalId = setInterval(checkStatus, 3000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentJobId, authToken]);

  if (!currentJobId || !job || dismissed) return null;

  const isRunning = job.status === 'running' || job.status === 'queued';
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';

  return (
    <div className="w-full bg-slate-900/90 border-b border-indigo-500/30 backdrop-blur px-6 py-2.5 flex items-center justify-between animate-in slide-in-from-top duration-300 z-30">
      <div className="flex items-center gap-3">
        {isRunning && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
        {isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
        {isFailed && <AlertTriangle className="w-4 h-4 text-rose-400" />}

        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-200 uppercase tracking-wider">
            Job #{job.id ? job.id.slice(0, 8) : ''}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
            isRunning ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
            isCompleted ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
            'bg-rose-500/20 text-rose-300 border border-rose-500/30'
          }`}>
            {job.status}
          </span>
          <span className="text-slate-400">({job.job_type || 'generation'})</span>
        </div>

        {isRunning && (
          <div className="flex items-center gap-2">
            <div className="w-32 bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-500"
                style={{ width: `${job.progress || 10}%` }}
              />
            </div>
            <span className="text-[11px] text-indigo-300 font-mono">{job.progress || 0}%</span>
          </div>
        )}

        {isFailed && (
          <span className="text-xs text-rose-400 truncate max-w-md">
            Error: {job.error || 'Pipeline execution failed'}
          </span>
        )}
      </div>

      <button
        onClick={() => setDismissed(true)}
        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        title="Dismiss banner"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
