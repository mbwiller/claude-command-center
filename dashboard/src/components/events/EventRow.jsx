/**
 * EventRow component - Displays a single event with expandable details
 */

import { ChevronRight, XCircle, Circle } from 'lucide-react';
import { agentColors, eventIcons, getEventLabel } from '../../constants/design-system';
import { formatTime } from '../../utils/formatters';

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

export default EventRow;
