import { useMemo, useState } from 'react';
import { Calendar, Trash2 } from 'lucide-react';

/**
 * Format number with K/M suffixes
 */
const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

/**
 * Format timestamp to readable date
 */
const formatDate = (timestamp) => {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Calculate session statistics
 */
const calculateSessionStats = (sessionEvents) => {
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
};

/**
 * Session card component with delete functionality
 *
 * @param {Object} session - Session data
 * @param {boolean} isSelected - Whether this session is selected
 * @param {Function} onClick - Click handler for selection
 * @param {Function} onDelete - Delete handler
 * @param {boolean} compact - Use compact display mode
 */
export function SessionCard({ session, isSelected, onClick, onDelete, compact = false }) {
  const [isHovered, setIsHovered] = useState(false);
  const stats = useMemo(() => calculateSessionStats(session.events), [session.events]);
  const isActive = Date.now() - new Date(session.lastEvent).getTime() < 60000;

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete?.(session.id);
  };

  // Truncate session ID for display
  const displayId = session.id.length > 20 ? session.id.slice(0, 17) + '...' : session.id;

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={onClick}
        className={`w-full text-left rounded-lg border transition-all duration-200 font-mono
          ${compact ? 'p-2' : 'p-3'}
          ${isSelected
            ? 'bg-cyan-500/10 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
            : isActive
              ? 'bg-slate-900/50 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
              : 'bg-slate-900/50 border-slate-700/50 hover:bg-slate-800/50 hover:border-slate-600/50'}`}
      >
        {/* Session ID and Status */}
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          )}
          <span className={`text-xs truncate ${isSelected ? 'text-cyan-300' : 'text-slate-300'}`}>
            {displayId}
          </span>
          {!compact && (
            <span className="ml-auto text-lg font-bold text-slate-200">{stats.eventCount}</span>
          )}
        </div>

        {/* Timestamp */}
        {!compact && (
          <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
            <Calendar className="w-3 h-3" />
            {formatDate(session.firstEvent)}
          </div>
        )}

        {/* Stats Grid - only show if not compact */}
        {!compact && (
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
            <div className="bg-slate-800/50 rounded p-1">
              <div className="text-[10px] text-cyan-400">{formatNumber(stats.totalTokens)}</div>
              <div className="text-[8px] text-slate-600">tok</div>
            </div>
            <div className="bg-slate-800/50 rounded p-1">
              <div className="text-[10px] text-emerald-400">${stats.totalCost.toFixed(3)}</div>
              <div className="text-[8px] text-slate-600">cost</div>
            </div>
            <div className="bg-slate-800/50 rounded p-1">
              <div className="text-[10px] text-amber-400">{stats.successRate.toFixed(0)}%</div>
              <div className="text-[8px] text-slate-600">ok</div>
            </div>
          </div>
        )}

        {/* Compact stats */}
        {compact && (
          <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
            <span className="text-cyan-400">{formatNumber(stats.totalTokens)} tok</span>
            <span className="text-slate-600">|</span>
            <span className="text-emerald-400">${stats.totalCost.toFixed(3)}</span>
          </div>
        )}
      </button>

      {/* Delete button - appears on hover */}
      {isHovered && onDelete && (
        <button
          onClick={handleDelete}
          className="absolute top-1 right-1 p-1.5 rounded-md bg-slate-800/90
            text-slate-400 hover:text-rose-400 hover:bg-rose-500/10
            transition-all opacity-0 group-hover:opacity-100 border border-slate-700/50
            hover:border-rose-500/30"
          title="Delete session"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
