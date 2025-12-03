import { Trash2, AlertTriangle, X } from 'lucide-react';

/**
 * Modal dialog to confirm session deletion
 */
export function DeleteConfirmModal({ sessionId, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl font-mono">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/10">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            </div>
            <h3 className="text-lg text-white">Delete Session?</h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <p className="text-sm text-slate-400 mb-2">
          This will permanently delete session:
        </p>
        <code className="block text-xs text-cyan-400 bg-slate-800 p-2 rounded mb-4 truncate">
          {sessionId}
        </code>
        <p className="text-xs text-slate-500 mb-6">
          All associated events will be removed. This action cannot be undone.
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm bg-slate-800 text-slate-300
              rounded-lg border border-slate-700 hover:bg-slate-700 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 text-sm bg-rose-500/20 text-rose-400
              rounded-lg border border-rose-500/30 hover:bg-rose-500/30 transition-all
              hover:shadow-lg hover:shadow-rose-500/20 flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
