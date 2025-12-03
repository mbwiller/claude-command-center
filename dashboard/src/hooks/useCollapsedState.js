import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'mbwiller-cccc-collapsed-projects';

/**
 * Hook to manage collapsed/expanded state for project groups
 * Persists state to localStorage
 */
export function useCollapsedState() {
  const [collapsedProjects, setCollapsedProjects] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Persist to localStorage when state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsedProjects]));
    } catch {
      // Ignore localStorage errors
    }
  }, [collapsedProjects]);

  const toggleProject = useCallback((projectPath) => {
    setCollapsedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectPath)) {
        next.delete(projectPath);
      } else {
        next.add(projectPath);
      }
      return next;
    });
  }, []);

  const collapseAll = useCallback((allProjectPaths) => {
    setCollapsedProjects(new Set(allProjectPaths));
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedProjects(new Set());
  }, []);

  const isCollapsed = useCallback((projectPath) => {
    return collapsedProjects.has(projectPath);
  }, [collapsedProjects]);

  return {
    collapsedProjects,
    toggleProject,
    collapseAll,
    expandAll,
    isCollapsed,
  };
}
