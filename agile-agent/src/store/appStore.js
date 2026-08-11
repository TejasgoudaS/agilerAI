import { create } from 'zustand';

export const useAppStore = create((set) => ({
  // Data
  prdText: '',
  uploadedFileName: null,
  epics: [],
  stories: [],
  dependencies: [],
  sprints: [],
  globalRisks: [],
  team: [],
  knowledgeGraph: null,
  
  // Jira Metadata
  jiraProjects: [],
  jiraBoards: [],
  jiraSprints: [],
  
  // Selected Context
  selectedProject: null,
  selectedBoard: null,
  selectedSprint: null,
  
  // App State
  currentStep: 'landing', // 'landing', 'processing', 'dashboard'
  processingStep: '', // e.g. 'Parsing PRD...', 'Generating Stories...'
  
  // Agent Pipeline State
  activeAgent: null,       // { agent, role, description }
  agentLogs: [],           // [{ agent, type, text, timestamp }]
  streamingText: '',       // Live text from agents
  agentPipeline: [         // Static pipeline definition for UI
    { id: 'architect', name: 'Architect Agent', role: 'Solutions Architect', status: 'pending' },
    { id: 'pm', name: 'PM Agent', role: 'Product Manager', status: 'pending' },
    { id: 'engineer', name: 'Engineer Agent', role: 'Lead Engineer', status: 'pending' },
    { id: 'qa', name: 'QA Agent', role: 'QA Engineer', status: 'pending' },
  ],
  agentStories: { agent: null, stories: [] },  // Live stories from the active agent
  
  // Config
  jiraConfig: {
    projectKey: import.meta.env.VITE_JIRA_PROJECT_KEY || ''
  },
  
  // Actions
  setPrdText: (text) => set({ prdText: text }),
  setUploadedFileName: (name) => set({ uploadedFileName: name }),
  setEpics: (epics) => set({ epics }),
  setStories: (stories) => set({ stories }),
  setDependencies: (dependencies) => set({ dependencies }),
  setSprints: (sprints) => set({ sprints }),
  setGlobalRisks: (risks) => set({ globalRisks: risks }),
  setKnowledgeGraph: (graph) => set({ knowledgeGraph: graph }),
  
  setTeam: (team) => set({ team }),
  
  updateTeamMemberSeniority: (id, seniority) => set((state) => ({
    team: state.team.map(member => 
      member.id === id ? { ...member, seniority } : member
    )
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
    agentPipeline: state.agentPipeline.map(a => 
      a.name === agentName ? { ...a, status } : a
    )
  })),
  setAgentStories: (agent, stories) => set({ agentStories: { agent, stories } }),
  
  resetSession: () => set({
    prdText: '',
    uploadedFileName: null,
    epics: [],
    stories: [],
    dependencies: [],
    sprints: [],
    globalRisks: [],
    knowledgeGraph: null,
    currentStep: 'landing',
    processingStep: '',
    activeAgent: null,
    agentLogs: [],
    streamingText: '',
    agentPipeline: [
      { id: 'architect', name: 'Architect Agent', role: 'Solutions Architect', status: 'pending' },
      { id: 'pm', name: 'PM Agent', role: 'Product Manager', status: 'pending' },
      { id: 'engineer', name: 'Engineer Agent', role: 'Lead Engineer', status: 'pending' },
      { id: 'qa', name: 'QA Agent', role: 'QA Engineer', status: 'pending' },
    ],
    agentStories: { agent: null, stories: [] }
  })
}));
