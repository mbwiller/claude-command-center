/**
 * Design system constants for the Claude Code Command Center dashboard
 */

import {
  Activity, Zap, CheckCircle2, XCircle,
  Users, MessageSquare, Circle, Square, Radio
} from 'lucide-react';

/**
 * Color schemes for different agent types
 */
export const agentColors = {
  'researcher': { bg: 'bg-violet-500/15', border: 'border-violet-400/50', text: 'text-violet-300', rgb: '139, 92, 246' },
  'implementer': { bg: 'bg-emerald-500/15', border: 'border-emerald-400/50', text: 'text-emerald-300', rgb: '16, 185, 129' },
  'reviewer': { bg: 'bg-amber-500/15', border: 'border-amber-400/50', text: 'text-amber-300', rgb: '245, 158, 11' },
  'consensus': { bg: 'bg-cyan-500/15', border: 'border-cyan-400/50', text: 'text-cyan-300', rgb: '6, 182, 212' },
  'memory-keeper': { bg: 'bg-rose-500/15', border: 'border-rose-400/50', text: 'text-rose-300', rgb: '244, 63, 94' },
  'default': { bg: 'bg-slate-500/15', border: 'border-slate-400/50', text: 'text-slate-300', rgb: '100, 116, 139' },
};

/**
 * Icons and colors for different event types
 */
export const eventIcons = {
  'PreToolUse': { icon: Zap, color: 'text-amber-400' },
  'PostToolUse': { icon: CheckCircle2, color: 'text-emerald-400' },
  'SubagentStop': { icon: Users, color: 'text-violet-400' },
  'UserPromptSubmit': { icon: MessageSquare, color: 'text-blue-400' },
  'Notification': { icon: Radio, color: 'text-cyan-400' },
  'Stop': { icon: Square, color: 'text-slate-400' },
  'SessionStart': { icon: Activity, color: 'text-green-400' },
  'SessionEnd': { icon: Square, color: 'text-red-400' },
};

/**
 * Generate dynamic labels based on event content
 * @param {Object} event - Event object with hook_event_type and payload
 * @returns {string} Human-readable label for the event
 */
export const getEventLabel = (event) => {
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

/**
 * Get the agent style for a given agent type
 * @param {string} agentType - Agent type name
 * @returns {Object} Agent color scheme
 */
export const getAgentStyle = (agentType) => {
  return agentColors[agentType] || agentColors.default;
};

/**
 * Get the event icon info for a given event type
 * @param {string} hookEventType - Hook event type
 * @returns {Object} Object with icon component and color class
 */
export const getEventIconInfo = (hookEventType) => {
  return eventIcons[hookEventType] || { icon: Circle, color: 'text-slate-400' };
};
