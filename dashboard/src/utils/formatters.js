/**
 * Formatting utilities for the Claude Code Command Center dashboard
 */

/**
 * Format large numbers with K/M suffixes
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
export const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

/**
 * Format timestamp to time string (HH:MM:SS)
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Formatted time string
 */
export const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

/**
 * Format timestamp to date string (Mon DD, HH:MM)
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Formatted date string
 */
export const formatDate = (timestamp) => {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Format duration between two timestamps
 * @param {string} start - Start timestamp
 * @param {string} end - End timestamp
 * @returns {string} Formatted duration string
 */
export const formatDuration = (start, end) => {
  const ms = new Date(end) - new Date(start);
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
};

/**
 * Calculate statistics for a session's events
 * @param {Array} sessionEvents - Array of events for a session
 * @returns {Object} Stats object with eventCount, toolCounts, agentCounts
 */
export const calculateSessionStats = (sessionEvents) => {
  if (!sessionEvents || sessionEvents.length === 0) {
    return { eventCount: 0, toolCounts: {}, agentCounts: {} };
  }

  const toolCounts = {};
  const agentCounts = {};

  sessionEvents.forEach(e => {
    const tool = e.payload?.tool_name;
    if (tool) toolCounts[tool] = (toolCounts[tool] || 0) + 1;

    const agent = e.payload?.agent_name;
    if (agent) agentCounts[agent] = (agentCounts[agent] || 0) + 1;
  });

  return {
    eventCount: sessionEvents.length,
    toolCounts,
    agentCounts,
  };
};
