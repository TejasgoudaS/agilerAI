import { useAppStore } from '../store/appStore';
import toast from 'react-hot-toast';
import { 
  parsePRD, 
  generateStories, 
  assignStories, 
  detectDependencies, 
  planSprints,
  runAgentPipeline,
  checkAgentServer
} from '../lib/aiClient';
import { transformEpics, transformStories } from '../lib/storyTransformer';


export function usePRDProcessor() {
  const store = useAppStore();

  const processPRD = async () => {
    try {
      store.setCurrentStep('processing');
      
      // Step 1: Parse PRD
      store.setProcessingStep('Parsing requirements...');
      const parsedData = await parsePRD(store.prdText);
      const epics = transformEpics(parsedData.epics);
      store.setEpics(epics);
      store.setGlobalRisks(parsedData.globalRisks || []);

      // Step 2: Generate Stories via Multi-Agent Pipeline (or fallback)
      store.setProcessingStep('Connecting to AI engine...');
      const agentServerAvailable = await checkAgentServer(() => {
        store.setProcessingStep('Waking up the AI engine — free-tier hosting sleeps when idle, this can take up to a minute...');
      });

      let stories;

      if (agentServerAvailable) {
        // ── CrewAI Multi-Agent Pipeline ──
        store.setProcessingStep('Initializing AI Agent Pipeline...');
        
        const onEvent = (event) => {
          switch (event.type) {
            case 'agent_start':
              store.setActiveAgent({ 
                agent: event.agent, 
                role: event.role, 
                description: event.description 
              });
              store.updateAgentStatus(event.agent, 'active');
              store.setStreamingText('');
              store.setProcessingStep(`🤖 ${event.agent}: ${event.description}`);
              store.addAgentLog({ 
                agent: event.agent, 
                type: 'start', 
                text: event.description 
              });
              break;

            case 'agent_thought':
              store.appendStreamingText(event.text + '\n');
              store.addAgentLog({ 
                agent: event.agent, 
                type: 'thought', 
                text: event.text 
              });
              break;

            case 'agent_complete':
              store.updateAgentStatus(event.agent, 'complete');
              store.addAgentLog({ 
                agent: event.agent, 
                type: 'complete', 
                text: event.output 
              });
              // Save repo impact if returned by Repo Analyzer Agent
              if (event.data && event.agent === 'Repo Codebase Analyzer Agent') {
                store.setRepoImpact(event.data);
              }
              // If architect agent returned knowledge graph data
              if (event.data && event.agent === 'Architect Agent') {
                store.setKnowledgeGraph(event.data);
              }
              // If agent returned stories, show them live in the UI
              if (event.stories && event.stories.length > 0) {
                store.setAgentStories(event.agent, event.stories);
              }
              break;

            case 'error':
              toast.error(`Agent Error: ${event.message}`);
              store.addAgentLog({ 
                agent: 'System', 
                type: 'error', 
                text: event.message 
              });
              break;
          }
        };

        const result = await runAgentPipeline(store.prdText, epics, store.team, onEvent);
        stories = transformStories(result.stories, epics);
        store.setStories(stories);

        // Store knowledge graph, repo impact, and telemetry if provided
        if (result.knowledgeGraph && !store.knowledgeGraph) {
          store.setKnowledgeGraph(result.knowledgeGraph);
        }
        if (result.repoImpact) {
          store.setRepoImpact(result.repoImpact);
        }
        if (result.telemetry) {
          store.setTelemetry(result.telemetry);
        }
        if (result.qualityReport) {
          store.setQualityReport(result.qualityReport);
        }
        if (result.groundingSummary) {
          store.setGroundingSummary(result.groundingSummary);
        }
        store.setReflectionApplied(!!result.reflectionApplied);
        if (result.calibrationStatus) {
          store.setCalibrationStatus(result.calibrationStatus);
        }

      } else {
        // ── Fallback: Direct AI Call ──
        store.setProcessingStep('Generating user stories...');
        const storyData = await generateStories(epics);
        stories = transformStories(storyData.stories, epics);
        store.setStories(stories);
      }

      // Step 3: Assign Stories (if team exists)
      if (store.team.length > 0) {
        store.setProcessingStep('Assigning to team members...');
        const assignmentData = await assignStories(stories, store.team);
        
        // Merge assignments back into stories
        stories = stories.map(story => {
          const assignment = assignmentData.assignments?.find(a => a.storyId === story.id);
          if (assignment) {
            const teamMember = store.team.find(t => t.id === assignment.assigneeId || t.name === assignment.assigneeName || t.name === assignment.assignee);
            return { ...story, assigneeId: teamMember?.id || null };
          }
          return story;
        });
        store.setStories(stories);
      }

      // Step 4: Detect Dependencies
      store.setProcessingStep('Detecting dependencies...');
      const depData = await detectDependencies(stories);
      store.setDependencies(depData.dependencies || []);

      // Step 5: Plan Sprints
      store.setProcessingStep('Planning sprints...');
      const sprintData = await planSprints(stories, store.team, depData.dependencies);
      store.setSprints(sprintData.sprints || []);

      // Auto-save session to persistent storage
      const sessionId = await store.saveSessionToServer();
      if (sessionId) {
        console.log(`Session saved with ID: ${sessionId}`);
      }

      toast.success('PRD processed with RAG Codebase Grounding!');
      store.setCurrentStep('dashboard');

    } catch (error) {
      console.error(error);
      toast.error('Failed to process PRD: ' + error.message);
      store.setCurrentStep('landing');
    }
  };

  return { processPRD };
}
