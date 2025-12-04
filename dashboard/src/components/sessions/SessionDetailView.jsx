/**
 * SessionDetailView component - Displays detailed view of a session's events
 */

import { useState, useMemo, useCallback } from 'react';
import { Activity, Calendar, Clock3, FolderOpen, Filter } from 'lucide-react';
import EventRow from '../events/EventRow';
import { agentColors } from '../../constants/design-system';
import { formatDate, formatDuration, calculateSessionStats } from '../../utils/formatters';

const SessionDetailView = ({ session }) => {
  const [expandedEvents, setExpandedEvents] = useState(new Set());
  const [eventFilter, setEventFilter] = useState('all');

  const stats = useMemo(() => calculateSessionStats(session?.events || []), [session?.events]);

  const filteredEvents = useMemo(() => {
    if (!session?.events) return [];
    if (eventFilter === 'all') return session.events;
    return session.events.filter(e => e.hook_event_type === eventFilter);
  }, [session?.events, eventFilter]);

  const toggleExpand = useCallback((id) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-600">
        <div className="text-center">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a session to view details</p>
          <p className="text-xs mt-1 text-slate-700">Sessions appear when Claude Code hooks fire events</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Session Header */}
      <div className="p-4 border-b border-slate-800/50 bg-slate-900/30">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{session.id}</h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(session.firstEvent)}
              </span>
              <span className="flex items-center gap-1">
                <Clock3 className="w-3 h-3" />
                {formatDuration(session.firstEvent, session.lastEvent)}
              </span>
              {session.source_app && (
                <span className="flex items-center gap-1">
                  <FolderOpen className="w-3 h-3" />
                  {session.source_app}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats Row - Real data only */}
        <div className="mt-4 flex items-center gap-4">
          <div className="bg-slate-800/50 rounded-lg px-4 py-2 text-center">
            <div className="text-xl font-bold text-violet-400 font-mono">{stats.eventCount}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Events</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg px-4 py-2 text-center">
            <div className="text-xl font-bold text-cyan-400 font-mono">{Object.keys(stats.toolCounts).length}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Tools</div>
          </div>
          {Object.keys(stats.agentCounts).length > 0 && (
            <div className="bg-slate-800/50 rounded-lg px-4 py-2 text-center">
              <div className="text-xl font-bold text-emerald-400 font-mono">{Object.keys(stats.agentCounts).length}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Agents</div>
            </div>
          )}
        </div>

        {/* Tool & Agent Breakdown */}
        {(Object.keys(stats.toolCounts).length > 0 || Object.keys(stats.agentCounts).length > 0) && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            {Object.keys(stats.toolCounts).length > 0 && (
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Tools Used</div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(stats.toolCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tool, count]) => (
                    <span key={tool} className="px-2 py-1 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                      {tool} <span className="text-slate-500">×{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {Object.keys(stats.agentCounts).length > 0 && (
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Agents</div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(stats.agentCounts).map(([agent, count]) => {
                    const style = agentColors[agent] || agentColors.default;
                    return (
                      <span key={agent} className={`px-2 py-1 rounded text-[10px] ${style.bg} ${style.text}`}>
                        @{agent} <span className="opacity-60">×{count}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Event Filter */}
      <div className="p-3 border-b border-slate-800/50 flex items-center gap-3">
        <Filter className="w-4 h-4 text-slate-500" />
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="rounded-lg bg-slate-800/80 px-3 py-1.5 text-xs text-white border border-slate-700/50
            focus:outline-none focus:border-cyan-500/50"
        >
          <option value="all">All Events ({session.events.length})</option>
          <option value="PreToolUse">Pre-Tool</option>
          <option value="PostToolUse">Post-Tool</option>
          <option value="SubagentStop">Agent Done</option>
          <option value="UserPromptSubmit">User Input</option>
          <option value="Stop">Response</option>
        </select>
        <span className="ml-auto text-[10px] text-slate-500 font-mono">
          {filteredEvents.length} events
        </span>
      </div>

      {/* Event List */}
      <div className="flex-1 overflow-y-auto">
        {filteredEvents.length > 0 ? (
          <div className="divide-y divide-slate-800/30">
            {filteredEvents.map((event, index) => {
              // Use composite key to ensure uniqueness: session_id + event.id + index as fallback
              const uniqueKey = `${event.session_id}-${event.id}-${index}`;
              return (
                <EventRow
                  key={uniqueKey}
                  event={event}
                  isExpanded={expandedEvents.has(uniqueKey)}
                  onToggle={() => toggleExpand(uniqueKey)}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-600">
            <div className="text-center">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No events match filter</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionDetailView;
