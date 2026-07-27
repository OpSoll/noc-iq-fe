"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  AlertTriangleIcon,
  CheckIcon,
  RefreshCwIcon,
} from "@/components/ui/icons";
import type { BatchOperation, BatchProgress } from "@/features/outages/hooks/useBatchOperations";

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

interface BatchConfirmDialogProps {
  open: boolean;
  operation: BatchOperation | null;
  selectedCount: number;
  progress: BatchProgress | null;
  hasUnresolved: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/* -------------------------------------------------------------------------- */
/*                              Operation Labels                              */
/* -------------------------------------------------------------------------- */

const OPERATION_LABELS: Record<BatchOperation, { title: string; description: string; warning: string }> = {
  acknowledge: {
    title: "Acknowledge Outages",
    description: "Mark the selected outages as acknowledged. This will notify assigned responders and update incident status.",
    warning: "Acknowledged outages will be removed from the unacknowledged queue. This action cannot be undone.",
  },
  resolve: {
    title: "Resolve Outages",
    description: "Resolve all selected outages. This will stop SLA timers and trigger any applicable penalty/reward payments.",
    warning: "Resolved outages will be closed. SLA results and payments will be finalized. This action cannot be undone.",
  },
  "recalculate-sla": {
    title: "Recalculate SLA",
    description: "Recompute SLA metrics for all selected outages. This may change penalty/reward amounts based on the latest data.",
    warning: "SLA recalculation may affect financial amounts. Double-check the results after completion.",
  },
};

/* -------------------------------------------------------------------------- */
/*                                 Component                                  */
/* -------------------------------------------------------------------------- */

export function BatchConfirmDialog({
  open,
  operation,
  selectedCount,
  progress,
  hasUnresolved,
  onConfirm,
  onCancel,
}: BatchConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus trap and escape handling
  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    confirmBtnRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !progress) {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, progress, onCancel]);

  if (!open || !operation) return null;

  const labels = OPERATION_LABELS[operation];
  const isExecuting = progress !== null;
  const progressPercent = progress
    ? Math.round((progress.processed / progress.total) * 100)
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-confirm-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={isExecuting ? undefined : onCancel}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-start gap-4 border-b border-slate-100 px-6 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangleIcon className="h-5 w-5 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="batch-confirm-title"
              className="text-lg font-semibold text-slate-900"
            >
              {labels.title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {labels.description}
            </p>
          </div>
        </div>

        {/* Warning */}
        <div className="space-y-4 px-6 py-4">
          {/* Affected count */}
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <span className="text-sm font-medium text-slate-700">
              Affected outages
            </span>
            <span className="text-sm font-bold text-slate-900">
              {selectedCount}
            </span>
          </div>

          {/* Unresolved warning */}
          {operation === "resolve" && hasUnresolved && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-xs text-amber-700">
                Some selected outages include unresolved items. Resolving will
                finalize their SLA calculations.
              </p>
            </div>
          )}

          {/* Warning message */}
          <p className="text-xs leading-relaxed text-slate-500">
            {labels.warning}
          </p>

          {/* Progress bar */}
          {isExecuting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  Processing {progress.processed} of {progress.total}...
                </span>
                <span className="font-medium">{progressPercent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isExecuting}
          >
            Cancel
          </Button>
          <Button
            ref={confirmBtnRef}
            variant={operation === "recalculate-sla" ? "default" : "destructive"}
            size="sm"
            onClick={onConfirm}
            disabled={isExecuting}
            className="min-w-[100px]"
          >
            {isExecuting ? (
              <>
                <RefreshCwIcon className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckIcon className="h-4 w-4" />
                Confirm
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
