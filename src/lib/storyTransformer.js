// Utilities to ensure the AI-generated JSON is safe and formatted correctly

export function transformEpics(aiEpics) {
  if (!Array.isArray(aiEpics)) return [];
  return aiEpics.map((epic, index) => ({
    id: epic.id || `E${index + 1}`,
    name: epic.name || 'Untitled Epic',
    description: epic.description || '',
    type: epic.type || 'feature',
    risks: epic.risks || [],
  }));
}

export function transformStories(aiStories, epics) {
  if (!Array.isArray(aiStories)) return [];
  return aiStories.map((story, index) => {
    // Ensure epicId is valid
    const epicExists = epics.some(e => e.id === story.epicId);
    return {
      // Preserve any extra backend-enriched fields (affectedFiles, locEstimate,
      // groundingScore, qaQualityScore, calibratedStoryPoints, etc.) — only the
      // fields below are validated/defaulted, everything else passes through.
      ...story,
      id: story.id || `S${index + 1}`,
      epicId: epicExists ? story.epicId : (epics[0]?.id || null),
      title: story.title || 'Untitled Story',
      description: story.description || '',
      acceptanceCriteria: story.acceptanceCriteria || [],
      storyPoints: story.storyPoints || 3,
      type: story.type || 'feature',
      labels: story.labels || [],
      complexity: story.complexity || 'medium',
      assigneeId: story.assigneeId || null // May be added later by assigner
    };
  });
}
