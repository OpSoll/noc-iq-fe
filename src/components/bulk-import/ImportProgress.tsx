/**
 * Issue #630 – Import progress bar modal with cancel and completion summary.
 */

'use client';

export type ImportProgressPhase =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'success'
  | 'error'
  | 'cancelled';

export interface ImportProgressState {
  phase: ImportProgressPhase;
  /** 0–100 overall progress */
  percent: number;
  /** Rows successfully processed so far */
  processed: number;
  /** Total rows in the batch */
  total: number;
  /** Final summary when phase is success/error */
  summary?: {
    total: number;
    imported: number;
    failed: number;
    skipped?: number;
  };
}

export interface ImportProgressProps {
  state: ImportProgressState;
  onCancel?: () => void;
  onDismiss?: () => void;
  open?: boolean;
}

/**
 * Pure helper used by unit tests and the UI to derive display strings.
 */
export function formatProgressLabel(state: ImportProgressState): string {
  if (state.total <= 0) {
    return `${state.percent}%`;
  }
  return `${state.processed.toLocaleString()} / ${state.total.toLocaleString()}`;
}

export function ImportProgress({
  state,
  onCancel,
  onDismiss,
  open = true,
}: ImportProgressProps) {
  if (!open || state.phase === 'idle') {
    return null;
  }

  const isActive =
    state.phase === 'uploading' || state.phase === 'processing';
  const isDone =
    state.phase === 'success' ||
    state.phase === 'error' ||
    state.phase === 'cancelled';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-progress-title"
      data-testid="import-progress-modal"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2
          id="import-progress-title"
          className="text-lg font-semibold text-gray-900"
        >
          {state.phase === 'success' && 'Import complete'}
          {state.phase === 'error' && 'Import finished with errors'}
          {state.phase === 'cancelled' && 'Import cancelled'}
          {isActive && 'Importing outages…'}
        </h2>

        {isActive && (
          <div className="mt-4 space-y-2">
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
              role="progressbar"
              aria-valuenow={state.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              data-testid="import-progress-bar"
            >
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-200"
                style={{ width: `${Math.min(100, Math.max(0, state.percent))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span data-testid="import-progress-percent">{state.percent}%</span>
              <span data-testid="import-progress-counts">
                {formatProgressLabel(state)}
              </span>
            </div>
          </div>
        )}

        {isDone && state.summary && (
          <dl
            className="mt-4 grid grid-cols-3 gap-3 text-center"
            data-testid="import-progress-summary"
          >
            <div className="rounded-lg bg-gray-50 p-3">
              <dt className="text-xs text-gray-500">Total</dt>
              <dd className="text-lg font-semibold text-gray-900">
                {state.summary.total}
              </dd>
            </div>
            <div className="rounded-lg bg-green-50 p-3">
              <dt className="text-xs text-green-700">Imported</dt>
              <dd className="text-lg font-semibold text-green-800">
                {state.summary.imported}
              </dd>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <dt className="text-xs text-red-700">Failed</dt>
              <dd className="text-lg font-semibold text-red-800">
                {state.summary.failed}
              </dd>
            </div>
          </dl>
        )}

        <div className="mt-6 flex justify-end gap-2">
          {isActive && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
              data-testid="cancel-import-button"
            >
              Cancel Import
            </button>
          )}
          {isDone && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="dismiss-import-progress"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImportProgress;
