import axios from 'axios';

// We read config directly from environment variables.
const email = import.meta.env.VITE_JIRA_EMAIL || '';
const apiToken = import.meta.env.VITE_JIRA_API_TOKEN || '';
const auth = btoa(`${email}:${apiToken}`);
const defaultHeaders = {
  'Authorization': `Basic ${auth}`,
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'X-Atlassian-Token': 'no-check'
};

export async function getProjects() {
  try {
    const response = await axios.get('/rest/api/3/project', { headers: defaultHeaders });
    return response.data;
  } catch (error) {
    console.error('Failed to get projects', error);
    return [];
  }
}

export async function getBoards(projectKeyOrId) {
  try {
    const response = await axios.get(`/rest/agile/1.0/board?projectKeyOrId=${projectKeyOrId}`, { headers: defaultHeaders });
    return response.data.values || [];
  } catch (error) {
    console.error('Failed to get boards', error);
    return [];
  }
}

export async function getSprints(boardId) {
  try {
    const response = await axios.get(`/rest/agile/1.0/board/${boardId}/sprint?state=active,future`, { headers: defaultHeaders });
    return response.data.values || [];
  } catch (error) {
    console.error('Failed to get sprints', error);
    return [];
  }
}

export async function getAssignableUsers(projectKey) {
  try {
    const response = await axios.get(`/rest/api/3/user/assignable/search?project=${projectKey}`, { headers: defaultHeaders });
    return response.data || [];
  } catch (error) {
    console.error('Failed to get users', error);
    return [];
  }
}

export async function findJiraUser(displayName) {
  try {
    const response = await axios.get(
      `/rest/api/3/user/search?query=${encodeURIComponent(displayName)}`,
      { headers: defaultHeaders }
    );
    if (response.data && response.data.length > 0) {
      return response.data[0].accountId;
    }
  } catch (error) {
    console.warn(`Could not find Jira user for ${displayName}`);
  }
  return null;
}

export async function createEpic(epic, projectKey) {
  const response = await axios.post(
    `/rest/api/3/issue`,
    {
      fields: {
        project: { key: projectKey },
        summary: epic.name,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: epic.description || '' }]
            }
          ]
        },
        issuetype: { name: 'Epic' },
        labels: ['ai-generated']
      }
    },
    { headers: defaultHeaders }
  );

  return response.data;
}

export async function createStory(story, projectKey, epicJiraKey, assigneeAccountId = null, sprintId = null) {

  // Build proper Atlassian Document Format (ADF) — no literal \n strings
  const criteria = story.acceptanceCriteria || [];

  const descriptionAdf = {
    type: 'doc',
    version: 1,
    content: [
      // Story description paragraph
      {
        type: 'paragraph',
        content: [{ type: 'text', text: story.description || '' }]
      },
      // Bold "Acceptance Criteria:" heading
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Acceptance Criteria:', marks: [{ type: 'strong' }] }]
      },
      // Each criterion as a proper bullet list — NO \n joining
      ...(criteria.length > 0 ? [{
        type: 'bulletList',
        content: criteria.map(criterion => ({
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: String(criterion).replace(/^[-•*]\s*/, '') }]
          }]
        }))
      }] : [])
    ]
  };

  const payload = {
    fields: {
      project: { key: projectKey },
      summary: story.title,
      description: descriptionAdf,
      issuetype: { name: 'Story' },
      labels: [...(story.labels || []), 'ai-generated', story.type].filter(Boolean).map(l => l.replace(/\s+/g, '-'))
    }
  };

  if (epicJiraKey) {
    // Jira Cloud uses "parent" field to link stories to epics
    payload.fields.parent = { key: epicJiraKey };
  }

  if (assigneeAccountId) {
    payload.fields.assignee = { id: assigneeAccountId };
  }

  const response = await axios.post(
    `/rest/api/3/issue`,
    payload,
    { headers: defaultHeaders }
  );

  // Assign to sprint via the Agile API (separate call)
  if (sprintId && response.data.key) {
    try {
      await axios.post(
        `/rest/agile/1.0/sprint/${sprintId}/issue`,
        { issues: [response.data.key] },
        { headers: defaultHeaders }
      );
    } catch (e) {
      console.warn('Failed to assign to sprint:', e);
    }
  }

  return response.data;
}

export async function createIssueLink(inwardKey, outwardKey) {
  const response = await axios.post(
    `/rest/api/3/issueLink`,
    {
      type: { name: 'Blocks' },
      inwardIssue: { key: inwardKey },
      outwardIssue: { key: outwardKey }
    },
    { headers: defaultHeaders }
  );

  return response.data;
}
