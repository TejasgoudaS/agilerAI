import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useAppStore } from './store/appStore';
import { usePRDProcessor } from './hooks/usePRDProcessor';
import { useJiraSync } from './hooks/useJiraSync';
import {
  Sparkles, KanbanSquare, GitMerge, LayoutDashboard,
  Rocket, FileWarning, CheckCircle2, ExternalLink, X, RefreshCcw, Network,
  FolderGit2, History, Settings, LogOut, ChevronDown, User,
  GitBranch, Plug, BarChart2, ShieldCheck
} from 'lucide-react';

import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import UploadZone from './components/UploadZone';
import TeamProfileForm from './components/TeamProfileForm';
import JiraConfigForm from './components/JiraConfigForm';
import LoadingAnimation from './components/LoadingAnimation';
import StoryBoard from './components/StoryBoard';
import DependencyGraph from './components/DependencyGraph';
import SprintPlanView from './components/SprintPlanView';
import RiskPanel from './components/RiskPanel';
import KnowledgeGraphView from './components/KnowledgeGraphView';
import CodebaseIndexerModal from './components/CodebaseIndexerModal';
import TestGeneratorModal from './components/TestGeneratorModal';
import SessionHistoryPanel from './components/SessionHistoryPanel';
import SettingsModal from './components/SettingsModal';
import GitHubIndexerModal from './components/GitHubIndexerModal';
import IntegrationsPanel from './components/IntegrationsPanel';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import AIQualityPanel from './components/AIQualityPanel';
import JobStatusBanner from './components/JobStatusBanner';
import StoryVersionHistory from './components/StoryVersionHistory';

export default function App() {
  const {
    currentStep, prdText, resetSession, setCurrentStep,
    setIsIndexerOpen, codebaseStats,
    authToken, isAuthenticated, currentUser, setCurrentUser, logout,
    setIsHistoryOpen, setIsSettingsOpen,
    setIsGitHubIndexerOpen, setIsIntegrationsPanelOpen,
  } = useAppStore();

  const { processPRD } = usePRDProcessor();
  const { pushToJira, isPushing, syncResult } = useJiraSync();
  const [activeTab, setActiveTab] = useState('board');
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Re-hydrate current user info on refresh if token exists
  useEffect(() => {
    if (authToken && !currentUser) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${authToken}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setCurrentUser(data); })
        .catch(() => {});
    }
  }, [authToken]);

  const handleGenerate = () => {
    if (prdText) processPRD();
  };

  // ── Auth Gate ──────────────────────────────────────────────────────────
  // Allow using the marketing home page without auth
  if (!isAuthenticated && currentStep !== 'home') {
    return (
      <div className="min-h-screen bg-background text-slate-200">
        <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#f8fafc', border: '1px solid #334155' } }} />
        <LoginPage onAuthenticated={() => setCurrentStep('landing')} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-slate-200 selection:bg-primary/30">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#f8fafc', border: '1px solid #334155' } }} />

      {/* Persistent Job Status Banner */}
      <JobStatusBanner />

      {/* Global Modals & Panels */}
      <CodebaseIndexerModal />
      <TestGeneratorModal />
      <SessionHistoryPanel />
      <SettingsModal />
      <GitHubIndexerModal />
      <IntegrationsPanel />
      <StoryVersionHistory />

      {/* Header */}
      <header className="border-b border-slate-800 bg-surface/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <button
            type="button"
            onClick={() => setCurrentStep(isAuthenticated ? 'landing' : 'home')}
            className="flex items-center gap-3 text-left cursor-pointer"
          >
            <div className="bg-gradient-to-br from-primary to-secondary p-2 rounded-lg shadow-lg shadow-primary/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary leading-none">
                Agiler AI
              </h1>
              <span className="text-[10px] text-slate-500 font-mono">Autonomous AI Agent for Agile Delivery</span>
            </div>
          </button>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <>
                {/* GitHub Indexer */}
                <button
                  onClick={() => setIsGitHubIndexerOpen(true)}
                  className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-medium text-slate-200 transition-all cursor-pointer shadow-sm"
                  title="Index from GitHub URL"
                >
                  <GitBranch className="w-4 h-4 text-slate-300" />
                  <span>GitHub</span>
                </button>

                {/* Codebase RAG Badge */}
                <button
                  onClick={() => setIsIndexerOpen(true)}
                  className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-medium text-slate-200 transition-all cursor-pointer shadow-sm"
                >
                  <FolderGit2 className="w-4 h-4 text-indigo-400" />
                  <span>{codebaseStats ? `${codebaseStats.fileCount} Files` : 'Index Codebase'}</span>
                  {codebaseStats && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>}
                </button>

                {/* Integrations */}
                <button
                  onClick={() => setIsIntegrationsPanelOpen(true)}
                  className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Integrations (Confluence, Slack)"
                >
                  <Plug className="w-4.5 h-4.5" />
                </button>

                {/* Session History */}
                <button
                  onClick={() => setIsHistoryOpen(true)}
                  className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Session History"
                >
                  <History className="w-4.5 h-4.5" />
                </button>

                {/* Settings */}
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Settings"
                >
                  <Settings className="w-4.5 h-4.5" />
                </button>
              </>
            )}

            {/* Dashboard action buttons */}
            {isAuthenticated && currentStep === 'dashboard' && (
              <>
                <button
                  onClick={resetSession}
                  className="flex items-center gap-2 text-slate-400 hover:text-slate-200 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium cursor-pointer"
                >
                  <RefreshCcw className="w-4 h-4" />
                  <span className="hidden sm:inline">New Session</span>
                </button>
                <button
                  onClick={pushToJira}
                  disabled={isPushing}
                  className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-white px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm"
                >
                  <Rocket className="w-4 h-4" />
                  {isPushing ? 'Pushing...' : 'Push to Jira'}
                </button>
              </>
            )}

            {/* Landing Get Started */}
            {!isAuthenticated && currentStep === 'home' && (
              <button
                onClick={() => setCurrentStep('login')}
                className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-white px-5 py-2 rounded-lg font-medium transition-all shadow-lg shadow-primary/20 cursor-pointer"
              >
                Get started
              </button>
            )}

            {/* User Avatar / Menu */}
            {isAuthenticated && currentUser && (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 pl-1 pr-2.5 py-1 bg-slate-900 border border-slate-700/60 rounded-xl cursor-pointer hover:bg-slate-800 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
                    {currentUser.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="text-sm text-slate-200 font-medium hidden sm:block max-w-[100px] truncate">
                    {currentUser.name}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-slate-700/80 rounded-xl shadow-xl z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-4 py-3 border-b border-slate-800">
                        <p className="text-sm font-medium text-white truncate">{currentUser.name}</p>
                        <p className="text-xs text-slate-400 truncate">{currentUser.email}</p>
                      </div>
                      <button
                        onClick={() => { setIsSettingsOpen(true); setUserMenuOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                      >
                        <Settings className="w-4 h-4 text-slate-400" /> Settings
                      </button>
                      <button
                        onClick={() => { logout(); setUserMenuOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer border-t border-slate-800"
                      >
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={`${currentStep === 'home' ? 'max-w-none mx-auto' : 'max-w-7xl mx-auto px-6 py-10'}`}>

        {/* Marketing Landing */}
        {currentStep === 'home' && (
          <LandingPage onGetStarted={() => {
            if (isAuthenticated) setCurrentStep('landing');
            else setCurrentStep('login');
          }} />
        )}

        {/* Login page (inline, not modal) — handles redirect itself */}
        {currentStep === 'login' && (
          <div className="min-h-[calc(100vh-4rem)] -mt-10 -mx-6">
            <LoginPage onAuthenticated={() => setCurrentStep('landing')} />
          </div>
        )}

        {/* Setup workspace */}
        {currentStep === 'landing' && isAuthenticated && (
          <div className="flex flex-col items-center gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center space-y-4 max-w-2xl">
              <p className="text-sm font-semibold tracking-[0.15em] uppercase text-indigo-400">
                Welcome back{currentUser?.name ? `, ${currentUser.name.split(' ')[0]}` : ''} 👋
              </p>
              <h2 className="text-4xl font-bold text-white leading-tight">
                From Document to Sprint<br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">in Minutes</span>
              </h2>
              <p className="text-lg text-slate-400">
                Upload your PRD — AI indexes your codebase, grounds story points in real file complexity,
                and syncs directly to Jira. Every session is saved automatically.
              </p>
            </div>

            <div className="w-full flex justify-center">
              <UploadZone />
            </div>

            <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
              <TeamProfileForm />
              <JiraConfigForm />
            </div>

            <div className="w-full max-w-4xl pt-2 border-t border-slate-800 flex flex-col items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={!prdText}
                id="generate-btn"
                className="flex items-center gap-3 bg-gradient-to-r from-primary to-secondary text-white px-10 py-4 rounded-2xl font-bold text-lg hover:shadow-[0_0_40px_rgba(99,102,241,0.4)] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none cursor-pointer"
              >
                <Sparkles className="w-6 h-6" />
                Generate Agile Plan (RAG Aware)
              </button>
              {!prdText && (
                <p className="text-slate-500 text-sm">Upload a PRD document first to get started</p>
              )}
            </div>
          </div>
        )}

        {/* Processing */}
        {currentStep === 'processing' && <LoadingAnimation />}

        {/* Dashboard */}
        {currentStep === 'dashboard' && (
          <div className="animate-in fade-in duration-700 space-y-6">

            {syncResult && <JiraSyncSuccessBanner syncResult={syncResult} />}

            {/* Tab Bar */}
            <div className="flex space-x-1 bg-surface border border-slate-700 p-1 rounded-xl overflow-x-auto">
              <TabButton active={activeTab === 'board'} onClick={() => setActiveTab('board')} icon={<KanbanSquare />} label="Story Board" />
              <TabButton active={activeTab === 'graph'} onClick={() => setActiveTab('graph')} icon={<GitMerge />} label="Dependencies" />
              <TabButton active={activeTab === 'knowledge'} onClick={() => setActiveTab('knowledge')} icon={<Network />} label="Knowledge Graph" />
              <TabButton active={activeTab === 'sprint'} onClick={() => setActiveTab('sprint')} icon={<LayoutDashboard />} label="Sprint Plan" />
              <TabButton active={activeTab === 'risk'} onClick={() => setActiveTab('risk')} icon={<FileWarning />} label="Risk Report" />
              <TabButton active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} icon={<BarChart2 />} label="Analytics" />
              <TabButton active={activeTab === 'quality'} onClick={() => setActiveTab('quality')} icon={<ShieldCheck />} label="AI Quality" />
            </div>

            <div className="min-h-[500px]">
              {activeTab === 'board' && <StoryBoard />}
              {activeTab === 'graph' && <DependencyGraph />}
              {activeTab === 'knowledge' && <KnowledgeGraphView />}
              {activeTab === 'sprint' && <SprintPlanView />}
              {activeTab === 'risk' && <RiskPanel />}
              {activeTab === 'analytics' && <AnalyticsDashboard />}
              {activeTab === 'quality' && <AIQualityPanel />}
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
          <a href={boardUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-2 text-sm text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" /> Open Jira Board
          </a>
        )}
      </div>
      <button onClick={() => setDismissed(true)}
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all whitespace-nowrap cursor-pointer text-sm
        ${active ? 'bg-primary/20 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
    >
      <span className="[&>svg]:w-4 [&>svg]:h-4">{icon}</span>
      {label}
    </button>
  );
}
