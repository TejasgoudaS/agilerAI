import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { useAppStore } from './store/appStore';
import { usePRDProcessor } from './hooks/usePRDProcessor';
import { useJiraSync } from './hooks/useJiraSync';
import {
  Sparkles, KanbanSquare, GitMerge, LayoutDashboard,
  Rocket, FileWarning, CheckCircle2, ExternalLink, X, RefreshCcw, Network
} from 'lucide-react';

import UploadZone from './components/UploadZone';
import TeamProfileForm from './components/TeamProfileForm';
import JiraConfigForm from './components/JiraConfigForm';
import LoadingAnimation from './components/LoadingAnimation';
import StoryBoard from './components/StoryBoard';
import DependencyGraph from './components/DependencyGraph';
import SprintPlanView from './components/SprintPlanView';
import RiskPanel from './components/RiskPanel';
import KnowledgeGraphView from './components/KnowledgeGraphView';

export default function App() {
  const { currentStep, prdText, resetSession } = useAppStore();
  const { processPRD } = usePRDProcessor();
  const { pushToJira, isPushing, syncResult } = useJiraSync();
  const [activeTab, setActiveTab] = useState('board');

  const handleGenerate = () => {
    if (prdText) processPRD();
  };

  return (
    <div className="min-h-screen bg-background text-slate-200 selection:bg-primary/30">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#f8fafc',
            border: '1px solid #334155',
          }
        }}
      />

      {/* Header */}
      <header className="border-b border-slate-800 bg-surface/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-primary to-secondary p-2 rounded-lg shadow-lg shadow-primary/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
              AI Agile Story Generator
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {currentStep === 'dashboard' && (
              <>
                <button
                  onClick={resetSession}
                  className="flex items-center gap-2 text-slate-400 hover:text-slate-200 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
                >
                  <RefreshCcw className="w-4 h-4" />
                  New Session
                </button>
                <button
                  onClick={pushToJira}
                  disabled={isPushing}
                  className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-white px-5 py-2 rounded-lg font-medium transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Rocket className="w-4 h-4" />
                  {isPushing ? 'Pushing to Jira...' : 'Push to Jira'}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">

        {/* Landing Page */}
        {currentStep === 'landing' && (
          <div className="flex flex-col items-center gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* Hero Text */}
            <div className="text-center space-y-4 max-w-2xl">
              <h2 className="text-4xl font-bold text-white leading-tight">
                From Document to Sprint<br/>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">in Minutes</span>
              </h2>
              <p className="text-lg text-slate-400">
                Upload your PRD and let AI auto-generate user stories, detect dependencies,
                assign tasks to your team, and plan your sprints — all synced to Jira.
              </p>
            </div>

            {/* Upload Zone */}
            <div className="w-full flex justify-center">
              <UploadZone />
            </div>

            {/* Config Grid */}
            <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
              <TeamProfileForm />
              <JiraConfigForm />
            </div>

            {/* Generate Button */}
            <div className="w-full max-w-4xl pt-2 border-t border-slate-800 flex flex-col items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={!prdText}
                id="generate-btn"
                className="flex items-center gap-3 bg-gradient-to-r from-primary to-secondary text-white px-10 py-4 rounded-2xl font-bold text-lg hover:shadow-[0_0_40px_rgba(99,102,241,0.4)] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
              >
                <Sparkles className="w-6 h-6" />
                Generate Agile Plan
              </button>
              {!prdText && (
                <p className="text-slate-500 text-sm">Upload a PRD document first to get started</p>
              )}
            </div>
          </div>
        )}

        {/* Processing */}
        {currentStep === 'processing' && (
          <LoadingAnimation />
        )}

        {/* Dashboard */}
        {currentStep === 'dashboard' && (
          <div className="animate-in fade-in duration-700 space-y-6">

            {/* Jira Success Banner */}
            {syncResult && (
              <JiraSyncSuccessBanner syncResult={syncResult} />
            )}

            {/* Tabs */}
            <div className="flex space-x-1 bg-surface border border-slate-700 p-1 rounded-xl overflow-x-auto">
              <TabButton active={activeTab === 'board'} onClick={() => setActiveTab('board')} icon={<KanbanSquare />} label="Story Board" />
              <TabButton active={activeTab === 'graph'} onClick={() => setActiveTab('graph')} icon={<GitMerge />} label="Dependencies" />
              <TabButton active={activeTab === 'knowledge'} onClick={() => setActiveTab('knowledge')} icon={<Network />} label="Knowledge Graph" />
              <TabButton active={activeTab === 'sprint'} onClick={() => setActiveTab('sprint')} icon={<LayoutDashboard />} label="Sprint Plan" />
              <TabButton active={activeTab === 'risk'} onClick={() => setActiveTab('risk')} icon={<FileWarning />} label="Risk Report" />
            </div>

            {/* Content */}
            <div className="min-h-[500px]">
              {activeTab === 'board' && <StoryBoard />}
              {activeTab === 'graph' && <DependencyGraph />}
              {activeTab === 'knowledge' && <KnowledgeGraphView />}
              {activeTab === 'sprint' && <SprintPlanView />}
              {activeTab === 'risk' && <RiskPanel />}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function JiraSyncSuccessBanner({ syncResult }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const boardUrl = syncResult.jiraBaseUrl
    ? `${syncResult.jiraBaseUrl}/jira/software/projects/${syncResult.projectKey}/boards`
    : null;

  return (
    <div className="relative flex items-start gap-4 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl p-5 animate-in slide-in-from-top-2 duration-500">
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center mt-0.5">
        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-emerald-300">Tickets Created Successfully!</p>
        <p className="text-sm text-emerald-400/80 mt-0.5">
          <span className="font-medium text-emerald-300">{syncResult.epicsCreated} Epic{syncResult.epicsCreated !== 1 ? 's' : ''}</span>
          {' and '}
          <span className="font-medium text-emerald-300">{syncResult.storiesCreated} Story/Stories</span>
          {' were pushed to '}
          <span className="font-medium text-emerald-300">{syncResult.projectName}</span>
          {' → '}
          <span className="font-medium text-emerald-300">{syncResult.sprintName}</span>
        </p>
        {boardUrl && (
          <a
            href={boardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-2 text-sm text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Jira Board
          </a>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap
        ${active
          ? 'bg-primary/20 text-primary shadow-sm'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
        }`}
    >
      <span className="[&>svg]:w-5 [&>svg]:h-5">{icon}</span>
      {label}
    </button>
  );
}
