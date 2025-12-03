import { ChevronRight, FolderOpen } from 'lucide-react';
import { SessionCard } from './SessionCard';

/**
 * Format number with K/M suffixes
 */
const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

/**
 * Project group component - collapsible container for sessions
 *
 * @param {Object} group - Project group data
 * @param {string} selectedSessionId - Currently selected session ID
 * @param {Function} onSelectSession - Handler for session selection
 * @param {Function} onDeleteSession - Handler for session deletion
 * @param {Function} onToggle - Handler for collapse/expand toggle
 */
export function ProjectGroup({
  group,
  selectedSessionId,
  onSelectSession,
  onDeleteSession,
  onToggle,
}) {
  const { projectPath, displayPath, sessions, isCollapsed, totalTokens, totalCost, totalEvents } = group;

  return (
    <div className="mb-3">
      {/* Group Header */}
      <button
        onClick={() => onToggle(projectPath)}
        className="w-full flex items-center gap-2 px-2 py-2 rounded-lg font-mono
          bg-slate-800/30 hover:bg-slate-800/50 transition-all group border border-slate-700/30
          hover:border-cyan-500/30"
        title={projectPath}
      >
        {/* Expand/Collapse Icon */}
        <ChevronRight
          className={`w-4 h-4 text-slate-500 transition-transform duration-200 flex-shrink-0
            ${!isCollapsed ? 'rotate-90' : ''} group-hover:text-cyan-400`}
        />

        {/* Folder Icon */}
        <FolderOpen className="w-4 h-4 text-cyan-400/70 flex-shrink-0" />

        {/* Project Path (last 2 segments) */}
        <span className="text-xs text-slate-300 truncate flex-1 text-left">
          {displayPath}
        </span>

        {/* Session Count */}
        <span className="text-[10px] text-slate-500 flex-shrink-0">
          {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
        </span>
      </button>

      {/* Collapsed Summary Stats */}
      {isCollapsed && (
        <div className="mt-1 ml-6 flex items-center gap-3 text-[10px] text-slate-600">
          <span className="text-cyan-400/60">{formatNumber(totalTokens)} tok</span>
          <span className="text-emerald-400/60">${totalCost.toFixed(3)}</span>
          <span className="text-slate-500">{totalEvents} events</span>
        </div>
      )}

      {/* Sessions (when expanded) */}
      {!isCollapsed && (
        <div className="mt-1 ml-3 pl-3 border-l border-slate-700/30 space-y-1.5">
          {sessions.map(session => (
            <SessionCard
              key={session.id}
              session={session}
              isSelected={selectedSessionId === session.id}
              onClick={() => onSelectSession(session.id)}
              onDelete={onDeleteSession}
              compact={sessions.length > 3}
            />
          ))}
        </div>
      )}
    </div>
  );
}
