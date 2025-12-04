/**
 * EmptyState component - Displays when no events are available
 */

import { Activity } from 'lucide-react';

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

export default EmptyState;
