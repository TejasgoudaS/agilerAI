import axios from 'axios';

export function getStoredToken() {
  return localStorage.getItem('ai_jira_token') || '';
}

export function authHeaders() {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

import {
  PRD_PARSER_PROMPT,
  STORY_GENERATOR_PROMPT,
  SMART_ASSIGNER_PROMPT,
  DEPENDENCY_DETECTOR_PROMPT,
  SPRINT_PLANNER_PROMPT
} from './prompts';

// Base function to call AI (non-streaming, used for non-agent calls)
async function callAI(systemPrompt, userContent) {
  const provider = import.meta.env.VITE_AI_PROVIDER || 'openai';
  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
  const claudeKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';

  if (provider === 'openai') {
    if (!openaiKey) {
      throw new Error('OpenAI API key is missing. Please configure it in the settings.');
    }
    
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
          ],
          temperature: 0.2,
          response_format: { type: "json_object" }
        },
        {
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const content = response.data.choices[0].message.content;
      return JSON.parse(content);
    } catch (error) {
      console.error('OpenAI API Error:', error);
      throw new Error(error.response?.data?.error?.message || error.message || 'Failed to call OpenAI API');
    }
    
  } else {
    // Claude
    if (!claudeKey) {
      throw new Error('Anthropic API key is missing. Please configure it in the settings.');
    }

    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-5-sonnet-20240620',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }],
          temperature: 0.2
        },
        {
          headers: {
            'x-api-key': claudeKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'anthropic-dangerously-allow-browser': 'true'
          }
        }
      );
      
      const content = response.data.content[0].text;
      
      const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return JSON.parse(content);
    } catch (error) {
      console.error('Claude API Error:', error);
      throw new Error(error.response?.data?.error?.message || error.message || 'Failed to call Claude API');
    }
  }
}

// ─────────────────────────────────────────────
// Multi-Agent Pipeline (SSE Streaming)
// ─────────────────────────────────────────────

/**
 * Check if the agent backend server is running.
 *
 * Free-tier hosts (e.g. Render) sleep after idle and can take 30-50s to wake
 * on the first request. A short timeout here would misread "still waking up"
 * as "unavailable" and silently drop to the client-side fallback path, which
 * doesn't even work in production (no OpenAI key is shipped in the bundle by
 * design — see .env.example). So this waits generously and optionally reports
 * progress via `onWaking` so the caller can show a "waking up" message instead
 * of looking hung.
 */
export async function checkAgentServer(onWaking) {
  const timeoutMs = 60000;
  const wakingNoticeAfterMs = 4000; // if it hasn't resolved quickly, it's a cold start

  const wakingTimer = onWaking ? setTimeout(() => onWaking(), wakingNoticeAfterMs) : null;
  try {
    const response = await axios.get('/api/health', {
      timeout: timeoutMs,
      headers: authHeaders()
    });
    return response.data?.status === 'ok';
  } catch {
    return false;
  } finally {
    if (wakingTimer) clearTimeout(wakingTimer);
  }
}

/**
 * Fire-and-forget ping to start waking a sleeping free-tier backend as early
 * as possible — call this on app mount so the cold start overlaps with the
 * time the user spends uploading a PRD, filling in team info, etc., instead
 * of only starting once they click "Generate."
 */
export function prewarmAgentServer() {
  axios.get('/api/health', { timeout: 60000 }).catch(() => {});
}

/**
 * Run the CrewAI multi-agent pipeline via SSE streaming.
 * Calls the FastAPI backend which runs agents: Repo Analyzer → Architect → PM → Engineer.
 */
export async function runAgentPipeline(prdText, epics, team, onEvent) {
  const response = await fetch('/api/generate-stories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ prdText, epics, team }),
  });

  if (!response.ok) {
    throw new Error(`Agent server error: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const event = JSON.parse(line.slice(6));
          
          if (event.type === 'heartbeat') continue;
          if (event.type === 'stream_end') continue;
          
          if (event.type === 'final_result') {
            finalResult = event;
          }
          
          // Notify the caller of every event
          if (onEvent) onEvent(event);
        } catch (e) {
          console.warn('Failed to parse SSE event:', line, e);
        }
      }
    }
  }

  if (!finalResult) {
    throw new Error('Agent pipeline did not return a final result');
  }

  return {
    stories: finalResult.stories || [],
    knowledgeGraph: finalResult.knowledgeGraph || { entities: [], relationships: [] },
    repoImpact: finalResult.repoImpact || null,
    telemetry: finalResult.telemetry || null,
    qualityReport: finalResult.qualityReport || null,
    groundingSummary: finalResult.groundingSummary || null,
    reflectionApplied: finalResult.reflectionApplied || false,
    calibrationStatus: finalResult.calibrationStatus || null
  };
}

// ─────────────────────────────────────────────
// Direct AI calls (non-agent, kept for fallback)
// ─────────────────────────────────────────────

export async function parsePRD(prdText) {
  return await callAI(PRD_PARSER_PROMPT, prdText);
}

export async function generateStories(epics) {
  return await callAI(STORY_GENERATOR_PROMPT, JSON.stringify({ epics }));
}

export async function assignStories(stories, team) {
  return await callAI(SMART_ASSIGNER_PROMPT, JSON.stringify({ stories, team }));
}

export async function detectDependencies(stories) {
  return await callAI(DEPENDENCY_DETECTOR_PROMPT, JSON.stringify({ stories }));
}

export async function planSprints(stories, assignments, dependencies) {
  return await callAI(SPRINT_PLANNER_PROMPT, JSON.stringify({ stories, assignments, dependencies }));
}
