/**
 * Claude Code Command Center - Main Dashboard Component
 * Real-time observability for Claude Code sessions
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity, Terminal, XCircle,
  Wifi, WifiOff, Hash, RefreshCw,
  ChevronsUpDown
} from 'lucide-react';

// Hooks
import { useEvents } from './hooks/useEvents';
import { useSessionGroups } from './hooks/useSessionGroups';
import { useCollapsedState } from './hooks/useCollapsedState';

// Components
import { ProjectGroup, DeleteConfirmModal, SessionDetailView } from './components/sessions';
import { EmptyState } from './components/common';

// Utilities
import { calculateSessionStats } from './utils/formatters';

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

export default function ClaudeCodeCommandCenter() {
  const { events, sessions, connected, connecting, clearEvents, deleteSession, mode } = useEvents('ws://localhost:4000/stream');
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [deleteModalSession, setDeleteModalSession] = useState(null);

  // Project grouping hooks
  const { collapsedProjects, toggleProject, expandAll, collapseAll } = useCollapsedState();
  const projectGroups = useSessionGroups(sessions, collapsedProjects);

  const sessionList = useMemo(() => {
    return Object.values(sessions).sort((a, b) =>
      new Date(b.lastEvent).getTime() - new Date(a.lastEvent).getTime()
    );
  }, [sessions]);

  const selectedSession = selectedSessionId ? sessions[selectedSessionId] : null;

  // Auto-select first session if none selected
  useEffect(() => {
    if (!selectedSessionId && sessionList.length > 0) {
      setSelectedSessionId(sessionList[0].id);
    }
  }, [sessionList, selectedSessionId]);

  // Handle session deletion
  const handleDeleteSession = useCallback((sessionId) => {
    setDeleteModalSession(sessionId);
  }, []);

  const confirmDeleteSession = useCallback(async () => {
    if (deleteModalSession) {
      await deleteSession(deleteModalSession);
      // Clear selection if we deleted the selected session
      if (selectedSessionId === deleteModalSession) {
        setSelectedSessionId(null);
      }
      setDeleteModalSession(null);
    }
  }, [deleteModalSession, deleteSession, selectedSessionId]);

  const totalStats = useMemo(() => {
    const allEvents = Object.values(sessions).flatMap(s => s.events);
    return calculateSessionStats(allEvents);
  }, [sessions]);

  return (
    <div className="h-screen flex flex-col bg-[#020617] text-white overflow-hidden">
      {/* Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@300;400;500;600;700&display=swap');
        body { font-family: 'Inter', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.5); }
        ::-webkit-scrollbar-thumb { background: rgba(100, 116, 139, 0.3); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(100, 116, 139, 0.5); }
      `}</style>

      {/* Header */}
      <header className="flex-shrink-0 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-xl">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-violet-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                <Terminal className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-mono font-medium text-white tracking-wide">Mbwiller Local Claude Command Center</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                  v2.0 // {mode === 'tauri' ? 'Desktop' : 'Browser'} Mode
                </p>
              </div>

            </div>

            <div className="flex items-center gap-4">
              {/* Global Stats - Real data only */}
              {sessionList.length > 0 && (
                <div className="hidden md:flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Hash className="w-3.5 h-3.5" />
                    <span className="font-mono">{sessionList.length}</span>
                    <span className="text-slate-600">sessions</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Activity className="w-3.5 h-3.5" />
                    <span className="font-mono">{totalStats.eventCount}</span>
                    <span className="text-slate-600">events</span>
                  </div>
                </div>
              )}

              {/* Connection Status */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs
                ${connected
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : connecting
                    ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'}`}>
                {connected ? <Wifi className="w-3 h-3" /> : connecting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <WifiOff className="w-3 h-3" />}
                <span className="font-medium">{connected ? 'Live' : connecting ? 'Connecting...' : 'Server Offline'}</span>
                {connected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
              </div>

              {/* Clear Button */}
              {events.length > 0 && (
                <button
                  onClick={clearEvents}
                  className="p-2 rounded-lg bg-slate-800/50 text-slate-400 border border-slate-700/50
                    hover:text-white hover:bg-slate-800 transition-all text-xs"
                  title="Clear all events"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      {sessionList.length === 0 ? (
        <EmptyState connected={connected} connecting={connecting} />
      ) : (
        <div className="flex-1 flex min-h-0">
          {/* Sessions Sidebar - Project Grouped */}
          <div className="w-80 flex-shrink-0 border-r border-slate-800/50 bg-slate-900/20 flex flex-col">
            <div className="p-3 border-b border-slate-800/50 flex items-center justify-between">
              <h3 className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
                Projects ({projectGroups.length})
              </h3>
              {projectGroups.length > 1 && (
                <button
                  onClick={() => {
                    const allPaths = projectGroups.map(g => g.projectPath);
                    const allCollapsed = allPaths.every(p => collapsedProjects.has(p));
                    if (allCollapsed) {
                      expandAll();
                    } else {
                      collapseAll(allPaths);
                    }
                  }}
                  className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-all"
                  title="Toggle all projects"
                >
                  <ChevronsUpDown className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {projectGroups.map(group => (
                <ProjectGroup
                  key={group.projectPath}
                  group={group}
                  selectedSessionId={selectedSessionId}
                  onSelectSession={setSelectedSessionId}
                  onDeleteSession={handleDeleteSession}
                  onToggle={toggleProject}
                />
              ))}
            </div>
          </div>

          {/* Session Detail */}
          <SessionDetailView session={selectedSession} />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalSession && (
        <DeleteConfirmModal
          sessionId={deleteModalSession}
          onConfirm={confirmDeleteSession}
          onCancel={() => setDeleteModalSession(null)}
        />
      )}
    </div>
  );
}
