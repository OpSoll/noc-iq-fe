"use client";

/**
 * StaleDataConflictModal
 *
 * Displayed when `useStaleGuard` detects that the server record has been
 * modified since the form was loaded.  Offers two actions:
 *   1. **View Diff** — calls `onViewDiff` so the consumer can show a side-by-side.
 *   2. **Overwrite** — invokes `onOverwrite` which runs the original submit.
 */

import Modal from "@/components/ui/modal";
import type { StaleConflict } from "@/hooks/useStaleGuard";

export interface StaleDataConflictModalProps {
  /** Non-null when a conflict is active. */
  conflict: StaleConflict | null;
  /** Close the modal without any side-effects. */
  onDismiss: () => void;
  /** Open a diff view (the consumer decides how to render this). */
  onViewDiff?: () => void;
  /** Force-overwrite the server data with the form values. */
  onOverwrite: () => void;
}

export default function StaleDataConflictModal({
  conflict,
  onDismiss,
  onViewDiff,
  onOverwrite,
}: StaleDataConflictModalProps) {
  if (!conflict) return null;

  const formDate = new Date(conflict.formUpdatedAt);
  const serverDate = new Date(conflict.serverUpdatedAt);

  const formatTimestamp = (d: Date): string =>
    d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  return (
    <Modal
      isOpen
      onClose={onDismiss}
      title="Data Conflict Detected"
      maxWidth="max-w-md"
      disableBackdropClose
    >
      {/* Warning icon + explanation */}
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100"
          aria-hidden
        >
          <svg
            className="h-6 w-6 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.56 20h18.88a1 1 0 00.87-1.28l-8.6-14.86a1 1 0 00-1.72 0z"
            />
          </svg>
        </div>

        <p className="text-sm text-slate-700">
          This record was modified by another operator after you opened it.
          Submitting now would overwrite their changes.
        </p>

        {/* Timestamp comparison */}
        <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-left text-xs">
          <div className="flex justify-between">
            <span className="font-medium text-slate-500">Your version</span>
            <span className="text-slate-700">{formatTimestamp(formDate)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="font-medium text-slate-500">Server version</span>
            <span className="font-semibold text-amber-700">
              {formatTimestamp(serverDate)}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          id="stale-conflict-cancel"
          onClick={onDismiss}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Cancel
        </button>

        {onViewDiff && (
          <button
            type="button"
            id="stale-conflict-view-diff"
            onClick={onViewDiff}
            className="rounded-md border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            View Diff
          </button>
        )}

        <button
          type="button"
          id="stale-conflict-overwrite"
          onClick={onOverwrite}
          className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          Overwrite
        </button>
      </div>
    </Modal>
  );
}
