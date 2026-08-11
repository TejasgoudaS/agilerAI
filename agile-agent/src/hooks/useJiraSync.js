import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { createEpic, createStory, createIssueLink, findJiraUser } from '../lib/jiraClient';
import toast from 'react-hot-toast';

export function useJiraSync() {
  const store = useAppStore();
  const [isPushing, setIsPushing] = useState(false);
  const [syncResult, setSyncResult] = useState(null); // { epicsCreated, storiesCreated, projectKey, sprintName }

  const pushToJira = async () => {
    if (!store.selectedProject) {
      toast.error('Please select a Jira Project in the destination configuration.');
      return;
    }

    try {
      setIsPushing(true);
      setSyncResult(null);
      
      const epicKeyMap = {};
      const storyKeyMap = {};
      const userKeyMap = {};
      let epicsCreated = 0;
      let storiesCreated = 0;

      // 1. Create Epics
      toast.loading(`Creating ${store.epics.length} Epic(s) in Jira...`, { id: 'jiraSync' });
      for (const epic of store.epics) {
        const jiraEpic = await createEpic(epic, store.selectedProject.key);
        epicKeyMap[epic.id] = jiraEpic.key;
        epicsCreated++;
      }

      // 2. Create Stories
      toast.loading(`Creating ${store.stories.length} Story/Stories in Jira...`, { id: 'jiraSync' });
      for (const story of store.stories) {
        const epicJiraKey = epicKeyMap[story.epicId];
        
        let assigneeAccountId = null; 
        if (story.assigneeId) {
          const teamMember = store.team.find(t => t.id === story.assigneeId);
          if (teamMember) {
            if (userKeyMap[teamMember.name] !== undefined) {
              assigneeAccountId = userKeyMap[teamMember.name];
            } else {
              assigneeAccountId = await findJiraUser(teamMember.name);
              userKeyMap[teamMember.name] = assigneeAccountId;
            }
          }
        }

        const sprintId = store.selectedSprint === 'backlog' ? null : store.selectedSprint;
        const jiraStory = await createStory(story, store.selectedProject.key, epicJiraKey, assigneeAccountId, sprintId);
        storyKeyMap[story.id] = jiraStory.key;
        storiesCreated++;
      }

      // 3. Create Links (Dependencies)
      if (store.dependencies.length > 0) {
        toast.loading('Linking Dependencies...', { id: 'jiraSync' });
        for (const dep of store.dependencies) {
          const inwardKey = storyKeyMap[dep.from];
          const outwardKey = storyKeyMap[dep.to];
          if (inwardKey && outwardKey) {
            await createIssueLink(inwardKey, outwardKey);
          }
        }
      }

      const sprintName = store.selectedSprint === 'backlog' || !store.selectedSprint
        ? 'Backlog'
        : store.jiraSprints.find(s => s.id.toString() === store.selectedSprint?.toString())?.name || 'Selected Sprint';

      setSyncResult({
        epicsCreated,
        storiesCreated,
        projectKey: store.selectedProject.key,
        projectName: store.selectedProject.name,
        sprintName,
        jiraBaseUrl: import.meta.env.VITE_JIRA_BASE_URL,
      });

      toast.success(`Pushed ${epicsCreated} epics & ${storiesCreated} stories to Jira!`, { id: 'jiraSync' });

    } catch (error) {
      console.error(error);
      let errMsg = error.message;
      if (error.response?.data) {
        const data = error.response.data;
        if (data.errorMessages && data.errorMessages.length > 0) {
          errMsg = data.errorMessages.join(', ');
        } else if (data.errors && Object.keys(data.errors).length > 0) {
          errMsg = Object.values(data.errors).join(', ');
        } else {
          errMsg = JSON.stringify(data);
        }
      }
      toast.error('Jira Sync Failed: ' + errMsg, { id: 'jiraSync' });
    } finally {
      setIsPushing(false);
    }
  };

  return { pushToJira, isPushing, syncResult };
}
