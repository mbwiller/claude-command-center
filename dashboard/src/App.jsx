import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Activity, Zap, Terminal, Filter,
  ChevronRight, CheckCircle2, XCircle,
  Users, MessageSquare,
  Circle, Square, Radio, Wifi, WifiOff,
  FolderOpen, Hash,
  Calendar, Clock3, RefreshCw,
  ChevronsUpDown
} from 'lucide-react';
import { ProjectGroup, DeleteConfirmModal } from './components/sessions';
import { useSessionGroups } from './hooks/useSessionGroups';
import { useCollapsedState } from './hooks/useCollapsedState';

// ═══════════════════════════════════════════════════════════════════════════════
// REAL DATA ONLY - NO DEMO/FAKE DATA
// ═══════════════════════════════════════════════════════════════════════════════

const useRealTimeEvents = (serverUrl) => {
  const [events, setEvents] = useState([]);
  const [sessions, setSessions] = useState({});
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const seenEventIdsRef = useRef(new Set()); // Track seen events for deduplication

  // Fetch existing events from server on mount
  const fetchExistingEvents = useCallback(async () => {
    try {
      const response = await fetch(`${serverUrl.replace('ws:', 'http:').replace('/stream', '')}/events/recent?limit=500`);
      if (response.ok) {
        const existingEvents = await response.json();
        if (existingEvents.length > 0) {
          // Deduplicate events by composite key (session_id + id + timestamp)
          const seenKeys = new Set();
          const dedupedEvents = existingEvents.filter(e => {
            const key = `${e.session_id}-${e.id}-${e.timestamp}`;
            if (seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
          });

          setEvents(dedupedEvents);
          // Populate seen event IDs for deduplication (using composite key)
          dedupedEvents.forEach(e => seenEventIdsRef.current.add(`${e.session_id}-${e.id}-${e.timestamp}`));
          // Build sessions from deduped events
          const sessionMap = {};
          dedupedEvents.forEach(event => {
            if (!sessionMap[event.session_id]) {
              sessionMap[event.session_id] = {
                id: event.session_id,
                source_app: event.source_app,
                events: [],
                firstEvent: event.timestamp,
                lastEvent: event.timestamp,
              };
            }
            sessionMap[event.session_id].events.push(event);
            if (event.timestamp < sessionMap[event.session_id].firstEvent) {
              sessionMap[event.session_id].firstEvent = event.timestamp;
            }
            if (event.timestamp > sessionMap[event.session_id].lastEvent) {
              sessionMap[event.session_id].lastEvent = event.timestamp;
            }
          });
          setSessions(sessionMap);
        }
      }
    } catch (e) {
      console.error('Failed to fetch existing events:', e);
    }
  }, [serverUrl]);

  useEffect(() => {
    // Track if this effect instance is still mounted (handles React StrictMode double-mount)
    let isMounted = true;
    let ws = null;

    const connect = () => {
      if (!isMounted) return; // Don't connect if unmounted

      setConnecting(true);
      try {
        const wsUrl = serverUrl.replace('http:', 'ws:');
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) {
            ws.close();
            return;
          }
          setConnected(true);
          setConnecting(false);
          // Fetch any existing events
          fetchExistingEvents();
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'event' && data.data) {
              const newEvent = data.data;

              // Deduplicate: skip if we've already seen this event (using composite key)
              const eventKey = `${newEvent.session_id}-${newEvent.id}-${newEvent.timestamp}`;
              if (seenEventIdsRef.current.has(eventKey)) {
                return;
              }
              seenEventIdsRef.current.add(eventKey);

              // Add to events list
              setEvents(prev => [newEvent, ...prev].slice(0, 1000));

              // Update sessions
              setSessions(prev => {
                const updated = { ...prev };
                if (!updated[newEvent.session_id]) {
                  updated[newEvent.session_id] = {
                    id: newEvent.session_id,
                    source_app: newEvent.source_app,
                    events: [],
                    firstEvent: newEvent.timestamp,
                    lastEvent: newEvent.timestamp,
                  };
                }
                updated[newEvent.session_id].events = [newEvent, ...updated[newEvent.session_id].events].slice(0, 500);
                updated[newEvent.session_id].lastEvent = newEvent.timestamp;
                return updated;
              });
            }

            // Handle session deletion broadcast
            if (data.type === 'session_deleted' && data.sessionId) {
              setSessions(prev => {
                const updated = { ...prev };
                delete updated[data.sessionId];
                return updated;
              });
              setEvents(prev => prev.filter(e => e.session_id !== data.sessionId));
            }

            // Handle events cleared broadcast
            if (data.type === 'events_cleared') {
              setEvents([]);
              setSessions({});
              seenEventIdsRef.current.clear();
            }
          } catch (e) {
            console.error('Failed to parse event:', e);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setConnected(false);
          setConnecting(false);
          // Reconnect after 3 seconds
          reconnectRef.current = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          if (!isMounted) return;
          setConnecting(false);
          ws?.close();
        };
      } catch (e) {
        if (!isMounted) return;
        setConnected(false);
        setConnecting(false);
      }
    };

    connect();

    return () => {
      isMounted = false;
      clearTimeout(reconnectRef.current);
      if (ws) {
        ws.close();
      }
    };
  }, [serverUrl, fetchExistingEvents]);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setSessions({});
    seenEventIdsRef.current.clear(); // Clear deduplication cache
  }, []);

  // Delete a session via API
  const deleteSession = useCallback(async (sessionId) => {
    // Optimistic update - remove from state immediately
    setSessions(prev => {
      const updated = { ...prev };
      delete updated[sessionId];
      return updated;
    });
    setEvents(prev => prev.filter(e => e.session_id !== sessionId));

    try {
      const apiUrl = serverUrl.replace('ws:', 'http:').replace('/stream', '');
      const response = await fetch(`${apiUrl}/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Delete failed');
      }
    } catch (e) {
      console.error('Failed to delete session:', e);
      // Refetch to restore state if delete failed
      fetchExistingEvents();
    }
  }, [serverUrl, fetchExistingEvents]);

  return { events, sessions, connected, connecting, clearEvents, deleteSession };
};

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

const agentColors = {
  'researcher': { bg: 'bg-violet-500/15', border: 'border-violet-400/50', text: 'text-violet-300', rgb: '139, 92, 246' },
  'implementer': { bg: 'bg-emerald-500/15', border: 'border-emerald-400/50', text: 'text-emerald-300', rgb: '16, 185, 129' },
  'reviewer': { bg: 'bg-amber-500/15', border: 'border-amber-400/50', text: 'text-amber-300', rgb: '245, 158, 11' },
  'consensus': { bg: 'bg-cyan-500/15', border: 'border-cyan-400/50', text: 'text-cyan-300', rgb: '6, 182, 212' },
  'memory-keeper': { bg: 'bg-rose-500/15', border: 'border-rose-400/50', text: 'text-rose-300', rgb: '244, 63, 94' },
  'default': { bg: 'bg-slate-500/15', border: 'border-slate-400/50', text: 'text-slate-300', rgb: '100, 116, 139' },
};

const eventIcons = {
  'PreToolUse': { icon: Zap, color: 'text-amber-400' },
  'PostToolUse': { icon: CheckCircle2, color: 'text-emerald-400' },
  'SubagentStop': { icon: Users, color: 'text-violet-400' },
  'UserPromptSubmit': { icon: MessageSquare, color: 'text-blue-400' },
  'Notification': { icon: Radio, color: 'text-cyan-400' },
  'Stop': { icon: Square, color: 'text-slate-400' },
  'SessionStart': { icon: Activity, color: 'text-green-400' },
  'SessionEnd': { icon: Square, color: 'text-red-400' },
};

// Generate dynamic labels based on event content
const getEventLabel = (event) => {
  const { hook_event_type, payload } = event;
  const toolName = payload?.tool_name;
  const agentType = payload?.agent_type || payload?.agent_name;
  const description = payload?.description;

  switch (hook_event_type) {
    case 'PreToolUse':
      if (toolName === 'Task' && agentType) {
        return `Spawning @${agentType}`;
      }
      return toolName ? `${toolName}` : 'Pre-Tool';
    case 'PostToolUse':
      // Show description for Bash, file path for Read/Edit/Write
      if (toolName === 'Bash' && description) {
        return description.length > 30 ? description.slice(0, 30) + '...' : description;
      }
      if (['Read', 'Edit', 'Write', 'Glob', 'Grep'].includes(toolName)) {
        const path = payload?.file_paths?.[0];
        if (path) {
          const filename = path.split(/[/\\]/).pop();
          return `${toolName}: ${filename}`;
        }
      }
      return toolName || 'Post-Tool';
    case 'SubagentStop':
      return agentType ? `@${agentType} Done` : 'Agent Done';
    case 'UserPromptSubmit':
      return 'User Input';
    case 'Stop':
      return 'Response Complete';
    case 'SessionStart':
      return 'Session Started';
    case 'SessionEnd':
      return 'Session Ended';
    default:
      return hook_event_type;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

const calculateSessionStats = (sessionEvents) => {
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

const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const formatDate = (timestamp) => {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDuration = (start, end) => {
  const ms = new Date(end) - new Date(start);
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const SessionCard = ({ session, isSelected, onClick }) => {
  const stats = useMemo(() => calculateSessionStats(session.events), [session.events]);
  const isActive = Date.now() - new Date(session.lastEvent).getTime() < 60000; // Active if event in last minute

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-all duration-200
        ${isSelected
          ? 'bg-cyan-500/10 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
          : 'bg-slate-900/50 border-slate-700/50 hover:bg-slate-800/50 hover:border-slate-600/50'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isActive && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
            <span className={`text-sm font-medium truncate ${isSelected ? 'text-cyan-300' : 'text-slate-200'}`}>
              {session.id}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(session.firstEvent)}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-slate-200 font-mono">{stats.eventCount}</div>
          <div className="text-[10px] text-slate-500">events</div>
        </div>
      </div>

      {/* Tool breakdown */}
      {Object.keys(stats.toolCounts).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {Object.entries(stats.toolCounts).slice(0, 4).map(([tool, count]) => (
            <span key={tool} className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800/80 text-slate-400 font-mono">
              {tool} <span className="text-slate-600">×{count}</span>
            </span>
          ))}
          {Object.keys(stats.toolCounts).length > 4 && (
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800/80 text-slate-500">
              +{Object.keys(stats.toolCounts).length - 4} more
            </span>
          )}
        </div>
      )}

      {session.source_app && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
          <FolderOpen className="w-3 h-3" />
          {session.source_app}
        </div>
      )}
    </button>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT ROW COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const EventRow = ({ event, isExpanded, onToggle }) => {
  const agentType = event.payload?.agent_type || event.payload?.agent_name;
  const agentStyle = agentColors[agentType] || agentColors.default;
  const eventInfo = eventIcons[event.hook_event_type] || { icon: Circle, color: 'text-slate-400' };
  const EventIcon = eventInfo.icon;
  const label = getEventLabel(event);
  const payload = event.payload || {};

  return (
    <div className={`group border-l-2 ${agentStyle.border} bg-slate-900/30 hover:bg-slate-800/40 transition-all`}>
      <div className="flex items-center gap-3 p-2.5 cursor-pointer" onClick={onToggle}>
        <div className="p-1.5 rounded-md bg-slate-800/80">
          <EventIcon className={`w-3.5 h-3.5 ${eventInfo.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-200">{label}</span>
            {agentType && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${agentStyle.bg} ${agentStyle.text}`}>
                @{agentType}
              </span>
            )}
            {payload.errors?.length > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-400">
                {payload.errors.length} error{payload.errors.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-600">
            <span>{formatTime(event.timestamp)}</span>
            {payload.command && (
              <>
                <span>•</span>
                <span className="text-amber-500/70 font-mono truncate max-w-[200px]">
                  {payload.command.length > 40 ? payload.command.slice(0, 40) + '...' : payload.command}
                </span>
              </>
            )}
            {payload.file_paths?.length > 0 && !payload.command && (
              <>
                <span>•</span>
                <span className="text-cyan-500/70 font-mono truncate max-w-[200px]">
                  {payload.file_paths[0].split(/[/\\]/).pop()}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {payload.errors?.length > 0 && (
            <XCircle className="h-3.5 w-3.5 text-rose-500/70" />
          )}
          <ChevronRight className={`h-3.5 w-3.5 text-slate-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </div>
      </div>
      {isExpanded && (
        <div className="border-t border-slate-800/50 bg-slate-950/50 p-3 space-y-3">
          {/* File paths */}
          {payload.file_paths?.length > 0 && (
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Files</span>
              <div className="mt-1 space-y-0.5">
                {payload.file_paths.map((p, i) => (
                  <code key={i} className="block text-[10px] text-cyan-400 font-mono truncate">{p}</code>
                ))}
              </div>
            </div>
          )}

          {/* Command */}
          {payload.command && (
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Command</span>
              <code className="block mt-1 text-[10px] text-amber-400 font-mono bg-slate-900 p-2 rounded overflow-x-auto">
                {payload.command}
              </code>
            </div>
          )}

          {/* Agent prompt */}
          {payload.agent_prompt && (
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Agent Task</span>
              <p className="mt-1 text-[10px] text-slate-300 whitespace-pre-wrap">{payload.agent_prompt}</p>
            </div>
          )}

          {/* Agent result */}
          {(payload.result || payload.result_summary) && (
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Result</span>
              <p className="mt-1 text-[10px] text-slate-400 whitespace-pre-wrap">
                {payload.result_summary || payload.result}
              </p>
            </div>
          )}

          {/* Errors */}
          {payload.errors?.length > 0 && (
            <div>
              <span className="text-[10px] text-rose-400 uppercase tracking-wider">Errors</span>
              <div className="mt-1 space-y-0.5">
                {payload.errors.map((e, i) => (
                  <code key={i} className="block text-[10px] text-rose-300 font-mono">{e}</code>
                ))}
              </div>
            </div>
          )}

          {/* Tool output preview */}
          {(payload.tool_output || payload.tool_output_preview) && (
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Output</span>
              <pre className="mt-1 text-[10px] text-slate-400 font-mono bg-slate-900 p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
                {payload.tool_output_preview || payload.tool_output}
              </pre>
            </div>
          )}

          {/* Raw JSON (collapsible) */}
          <details className="mt-2">
            <summary className="text-[10px] text-slate-600 cursor-pointer hover:text-slate-500">
              View raw payload
            </summary>
            <pre className="text-[10px] text-slate-500 overflow-x-auto font-mono mt-2 bg-slate-900 p-2 rounded">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION DETAIL VIEW
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════════════

const EmptyState = ({ connected, connecting }) => {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-800/50 border border-slate-700/50
          flex items-center justify-center">
          <Activity className="w-10 h-10 text-slate-600" />
        </div>

        <h2 className="text-xl font-semibold text-slate-300 mb-2">
          {connecting ? 'Connecting...' : connected ? 'Waiting for Events' : 'Server Offline'}
        </h2>

        <p className="text-sm text-slate-500 mb-6">
          {connecting
            ? 'Establishing connection to the observability server...'
            : connected
              ? 'No Claude Code events received yet. Start a new Claude Code session to see real-time events here.'
              : 'Cannot connect to the server at localhost:4000. Make sure the server is running.'}
        </p>

        {connected && (
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 text-left">
            <p className="text-xs text-slate-400 mb-3">To see events, open a new terminal and run:</p>
            <code className="block bg-slate-950 rounded-lg p-3 text-xs text-cyan-400 font-mono">
              claude
            </code>
            <p className="text-[10px] text-slate-600 mt-3">
              Events will appear here in real-time as you interact with Claude Code.
            </p>
          </div>
        )}

        {!connected && !connecting && (
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 text-left">
            <p className="text-xs text-slate-400 mb-3">Start the server:</p>
            <code className="block bg-slate-950 rounded-lg p-3 text-xs text-cyan-400 font-mono">
              cd claude-code-command-center\server<br/>
              npm run start:node
            </code>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

export default function ClaudeCodeCommandCenter() {
  const { events, sessions, connected, connecting, clearEvents, deleteSession } = useRealTimeEvents('ws://localhost:4000/stream');
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
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">v2.0 // Real-time Observability</p>
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
                <span className="font-medium">{connected ? 'Live' : connecting ? 'Connecting' : 'Offline'}</span>
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
