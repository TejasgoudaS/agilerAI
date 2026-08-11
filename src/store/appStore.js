import { create } from 'zustand';

// Pull stored token from localStorage (persists across page refreshes)
const storedToken = localStorage.getItem('ai_jira_token') || null;

export const useAppStore = create((set, get) => ({
  // ── Auth State ───────────────────────────────────────────────────────
  authToken: storedToken,
  currentUser: null,
  isAuthenticated: !!storedToken,

  setAuthToken: (token) => {
    localStorage.setItem('ai_jira_token', token || '');
    set({ authToken: token, isAuthenticated: !!token });
  },
  setCurrentUser: (user) => set({ currentUser: user }),
  logout: () => {
    localStorage.removeItem('ai_jira_token');
    set({
      authToken: null, currentUser: null, isAuthenticated: false,
      currentStep: 'home', stories: [], epics: [], sessions: []
    });
  },

  // ── Session History State ────────────────────────────────────────────
  sessions: [],
  isHistoryOpen: false,
  currentSessionId: null,

  setSessions: (sessions) => set({ sessions }),
  setIsHistoryOpen: (isOpen) => set({ isHistoryOpen: isOpen }),
  setCurrentSessionId: (id) => set({ currentSessionId: id }),

  // ── Settings Modal ───────────────────────────────────────────────────
  isSettingsOpen: false,
  setIsSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),

  // ── Phase 2: Job Queue State ──────────────────────────────────────────
  currentJobId: null,
  setCurrentJobId: (jobId) => set({ currentJobId: jobId }),

  // ── Phase 3: Integrations & Version History State ────────────────────
  isGitHubIndexerOpen: false,
  setIsGitHubIndexerOpen: (isOpen) => set({ isGitHubIndexerOpen: isOpen }),

  isIntegrationsPanelOpen: false,
  setIsIntegrationsPanelOpen: (isOpen) => set({ isIntegrationsPanelOpen: isOpen }),

  isVersionHistoryOpen: false,
  setIsVersionHistoryOpen: (isOpen) => set({ isVersionHistoryOpen: isOpen }),
  activeStoryForHistory: null,
  setActiveStoryForHistory: (story) => set({ activeStoryForHistory: story }),

  // ── Core Data ────────────────────────────────────────────────────────
  prdText: '',
  uploadedFileName: null,
  epics: [],
  stories: [],
  dependencies: [],
  sprints: [],
  globalRisks: [],
  team: [],
  knowledgeGraph: null,

  // Codebase RAG & Telemetry
  codebaseStats: null,
  isIndexerOpen: false,
  repoImpact: null,
  telemetry: null,

  // AI Quality: QA audit, grounding guardrail, reflection, velocity calibration
  qualityReport: null,
  groundingSummary: null,
  reflectionApplied: false,
  calibrationStatus: null,
  isQualityPanelOpen: false,

  // Test Generator
  selectedStoryForTest: null,
  isTestModalOpen: false,

  // Jira Metadata
  jiraProjects: [],
  jiraBoards: [],
  jiraSprints: [],
  selectedProject: null,
  selectedBoard: null,
  selectedSprint: null,

  // App State
  currentStep: 'home', // 'home' | 'landing' | 'processing' | 'dashboard'
  processingStep: '',

  // Agent Pipeline State
  activeAgent: null,
  agentLogs: [],
  streamingText: '',
  agentPipeline: [
    { id: 'analyzer', name: 'Repo Codebase Analyzer Agent', role: 'Codebase RAG Specialist', status: 'pending' },
    { id: 'architect', name: 'Architect Agent', role: 'Solutions Architect', status: 'pending' },
    { id: 'pm', name: 'PM Agent', role: 'Product Manager', status: 'pending' },
    { id: 'engineer', name: 'Engineer Agent', role: 'Lead Engineer', status: 'pending' },
    { id: 'qa', name: 'QA Agent', role: 'QA Engineer', status: 'pending' },
  ],
  agentStories: { agent: null, stories: [] },

  jiraConfig: {
    projectKey: import.meta.env.VITE_JIRA_PROJECT_KEY || ''
  },

  // ── Core Actions ─────────────────────────────────────────────────────
  setPrdText: (text) => set({ prdText: text }),
  setUploadedFileName: (name) => set({ uploadedFileName: name }),
  setEpics: (epics) => set({ epics }),
  setStories: (stories) => set({ stories }),
  setDependencies: (dependencies) => set({ dependencies }),
  setSprints: (sprints) => set({ sprints }),
  setGlobalRisks: (risks) => set({ globalRisks: risks }),
  setKnowledgeGraph: (graph) => set({ knowledgeGraph: graph }),

  setCodebaseStats: (stats) => set({ codebaseStats: stats }),
  setIsIndexerOpen: (isOpen) => set({ isIndexerOpen: isOpen }),
  setRepoImpact: (impact) => set({ repoImpact: impact }),
  setTelemetry: (telemetry) => set({ telemetry }),

  setQualityReport: (report) => set({ qualityReport: report }),
  setGroundingSummary: (summary) => set({ groundingSummary: summary }),
  setReflectionApplied: (applied) => set({ reflectionApplied: applied }),
  setCalibrationStatus: (status) => set({ calibrationStatus: status }),
  setIsQualityPanelOpen: (isOpen) => set({ isQualityPanelOpen: isOpen }),

  setSelectedStoryForTest: (story) => set({ selectedStoryForTest: story }),
  setIsTestModalOpen: (isOpen) => set({ isTestModalOpen: isOpen }),

  setTeam: (team) => set({ team }),
  updateTeamMemberSeniority: (id, seniority) => set((state) => ({
    team: state.team.map(member => member.id === id ? { ...member, seniority } : member)
  })),

  setJiraProjects: (projects) => set({ jiraProjects: projects }),
  setJiraBoards: (boards) => set({ jiraBoards: boards }),
  setJiraSprints: (sprints) => set({ jiraSprints: sprints }),
  setSelectedProject: (project) => set({ selectedProject: project }),
  setSelectedBoard: (board) => set({ selectedBoard: board }),
  setSelectedSprint: (sprint) => set({ selectedSprint: sprint }),

  updateJiraConfig: (config) => set((state) => ({ jiraConfig: { ...state.jiraConfig, ...config } })),

  setCurrentStep: (step) => set({ currentStep: step }),
  setProcessingStep: (step) => set({ processingStep: step }),

  // Agent Pipeline Actions
  setActiveAgent: (agent) => set({ activeAgent: agent }),
  setStreamingText: (text) => set({ streamingText: text }),
  appendStreamingText: (text) => set((state) => ({ streamingText: state.streamingText + text })),
  addAgentLog: (log) => set((state) => ({
    agentLogs: [...state.agentLogs, { ...log, timestamp: Date.now() }]
  })),
  updateAgentStatus: (agentName, status) => set((state) => ({
    agentPipeline: state.agentPipeline.map(a => a.name === agentName ? { ...a, status } : a)
  })),
  setAgentStories: (agent, stories) => set({ agentStories: { agent, stories } }),

  // ── Session Persistence ───────────────────────────────────────────────
  saveSessionToServer: async () => {
    const state = get();
    if (!state.authToken || !state.stories.length) return null;
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.authToken}`
        },
        body: JSON.stringify({
          title: state.uploadedFileName || 'Sprint Generation',
          prd_text: state.prdText,
          prd_filename: state.uploadedFileName,
          epics: state.epics,
          stories: state.stories,
          knowledge_graph: state.knowledgeGraph || {},
          repo_impact: state.repoImpact || {},
          telemetry: state.telemetry || {},
          agent_logs: state.agentLogs,
        })
      });
      if (res.ok) {
        const data = await res.json();
        set({ currentSessionId: data.id });
        return data.id;
      }
    } catch (e) {
      console.warn('Session auto-save failed:', e);
    }
    return null;
  },

  resetSession: () => set({
    prdText: '',
    uploadedFileName: null,
    epics: [],
    stories: [],
    dependencies: [],
    sprints: [],
    globalRisks: [],
    knowledgeGraph: null,
    repoImpact: null,
    telemetry: null,
    qualityReport: null,
    groundingSummary: null,
    reflectionApplied: false,
    currentSessionId: null,
    currentStep: 'landing',
    processingStep: '',
    activeAgent: null,
    agentLogs: [],
    streamingText: '',
    agentPipeline: [
      { id: 'analyzer', name: 'Repo Codebase Analyzer Agent', role: 'Codebase RAG Specialist', status: 'pending' },
      { id: 'architect', name: 'Architect Agent', role: 'Solutions Architect', status: 'pending' },
      { id: 'pm', name: 'PM Agent', role: 'Product Manager', status: 'pending' },
      { id: 'engineer', name: 'Engineer Agent', role: 'Lead Engineer', status: 'pending' },
      { id: 'qa', name: 'QA Agent', role: 'QA Engineer', status: 'pending' },
    ],
    agentStories: { agent: null, stories: [] }
  })
}));
