import fs from 'fs';
import axios from 'axios';

// Read variables from .env manually to avoid needing dotenv
const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1]] = match[2].trim();
  }
});

const { VITE_JIRA_EMAIL, VITE_JIRA_API_TOKEN, VITE_JIRA_BASE_URL, VITE_JIRA_PROJECT_KEY } = env;

if (!VITE_JIRA_EMAIL || !VITE_JIRA_API_TOKEN || !VITE_JIRA_BASE_URL || !VITE_JIRA_PROJECT_KEY) {
  console.error("Missing required Jira environment variables in .env");
  process.exit(1);
}

const auth = Buffer.from(`${VITE_JIRA_EMAIL}:${VITE_JIRA_API_TOKEN}`).toString('base64');

async function testJira() {
  console.log('Testing Jira API connection...');
  console.log(`Base URL: ${VITE_JIRA_BASE_URL}`);
  console.log(`Project Key: ${VITE_JIRA_PROJECT_KEY}`);
  console.log(`Email: ${VITE_JIRA_EMAIL}`);
  console.log('---');
  
  try {
    const response = await axios.post(
      `${VITE_JIRA_BASE_URL}/rest/api/3/issue`,
      {
        fields: {
          project: { key: VITE_JIRA_PROJECT_KEY },
          summary: "Test Ticket from Node.js Script",
          description: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "This is a test ticket to verify the API credentials and project key." }]
              }
            ]
          },
          // We use 'Task' here since it is usually a default issue type in all projects
          issuetype: { name: "Task" }, 
        }
      },
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Atlassian-Token': 'no-check'
        }
      }
    );
    console.log('✅ Success! Ticket created:', response.data.key);
    console.log(`Link: ${VITE_JIRA_BASE_URL}/browse/${response.data.key}`);
  } catch (error) {
    console.error('❌ Failed to create ticket.');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

testJira();
