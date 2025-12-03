import { useMemo } from 'react';

/**
 * Extract display path from full path (last 2 segments)
 * Example: "C:\Users\Matt Willer\hacklearn-pro" -> "Matt Willer/hacklearn-pro"
 */
export function getDisplayPath(fullPath) {
  if (!fullPath) return 'Unknown';
  const segments = fullPath.split(/[/\\]/).filter(Boolean);
  return segments.slice(-2).join('/');
}

/**
 * Extract just the project name (last segment)
 * Example: "C:\Users\Matt Willer\hacklearn-pro" -> "hacklearn-pro"
 */
export function getProjectName(fullPath) {
  if (!fullPath) return 'Unknown';
  const segments = fullPath.split(/[/\\]/).filter(Boolean);
  return segments[segments.length - 1] || fullPath;
}

/**
 * Calculate session statistics
 */
function calculateSessionStats(sessionEvents) {
  if (!sessionEvents || sessionEvents.length === 0) {
    return { totalTokens: 0, totalCost: 0, successRate: 100, eventCount: 0 };
  }

  const totalTokens = sessionEvents.reduce((sum, e) => sum + (e.payload?.tokens_used || 0), 0);
  const totalCost = sessionEvents.reduce((sum, e) => sum + parseFloat(e.payload?.cost_usd || 0), 0);
  const successCount = sessionEvents.filter(e => e.payload?.success !== false).length;

  return {
    totalTokens,
    totalCost,
    successRate: sessionEvents.length > 0 ? (successCount / sessionEvents.length * 100) : 100,
    eventCount: sessionEvents.length,
  };
}

/**
 * Hook to group sessions by project (source_app/working directory)
 *
 * @param {Object} sessions - Map of session_id -> session object
 * @param {Set} collapsedProjects - Set of collapsed project paths
 * @returns {Array} Array of project groups sorted by last activity
 */
export function useSessionGroups(sessions, collapsedProjects) {
  return useMemo(() => {
    const groups = new Map();

    Object.values(sessions).forEach(session => {
      // Use source_app as the working directory/project path
      const workingDir = session.source_app || 'Unknown Project';
      const projectName = getProjectName(workingDir);
      const displayPath = getDisplayPath(workingDir);

      if (!groups.has(workingDir)) {
        groups.set(workingDir, {
          projectPath: workingDir,
          projectName,
          displayPath,
          sessions: [],
          lastActivity: session.lastEvent,
          totalTokens: 0,
          totalCost: 0,
          totalEvents: 0,
          isCollapsed: collapsedProjects?.has(workingDir) || false,
        });
      }

      const group = groups.get(workingDir);
      group.sessions.push(session);

      // Update last activity if this session is more recent
      if (new Date(session.lastEvent) > new Date(group.lastActivity)) {
        group.lastActivity = session.lastEvent;
      }

      // Aggregate stats
      const stats = calculateSessionStats(session.events);
      group.totalTokens += stats.totalTokens;
      group.totalCost += stats.totalCost;
      group.totalEvents += stats.eventCount;
    });

    // Sort sessions within each group by most recent first
    groups.forEach(group => {
      group.sessions.sort((a, b) =>
        new Date(b.lastEvent).getTime() - new Date(a.lastEvent).getTime()
      );
    });

    // Return as array sorted by last activity (most recent first)
    return Array.from(groups.values()).sort((a, b) =>
      new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
  }, [sessions, collapsedProjects]);
}
