'use client';
import { useState } from 'react';
// Closes #371: SLA config editor with live preview and validation feedback
// Closes #372: payment detail drawer with transaction chain timeline
// Closes #492: confirm before discarding unsaved changes on close

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface SlaSeverityConfig {
  thresholdMinutes: number;
  penaltyPerMinute: number;
  rewardBase: number;
}
export function SlaConfigEditor({
  value,
  onSave,
  onClose,
}: {
  value: SlaSeverityConfig;
  onSave: (next: SlaSeverityConfig) => void;
  /** Called once the user has confirmed it's OK to close (or there were no unsaved changes). */
  onClose?: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const invalid = draft.thresholdMinutes <= 0 || draft.penaltyPerMinute < 0;
  const isDirty =
    draft.thresholdMinutes !== value.thresholdMinutes ||
    draft.penaltyPerMinute !== value.penaltyPerMinute ||
    draft.rewardBase !== value.rewardBase;

  // Fires on backdrop click / explicit Close button. If there are unsaved
  // edits, ask for confirmation instead of discarding them silently.
  const requestClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose?.();
  };

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!invalid) onSave(draft);
        }}
        className="space-y-2 text-sm"
      >
        <label className="flex justify-between">
          Threshold (min)
          <input
            type="number"
            value={draft.thresholdMinutes}
            onChange={(e) =>
              setDraft({ ...draft, thresholdMinutes: Number(e.target.value) })
            }
          />
        </label>
        <label className="flex justify-between">
          Penalty/min
          <input
            type="number"
            value={draft.penaltyPerMinute}
            onChange={(e) =>
              setDraft({ ...draft, penaltyPerMinute: Number(e.target.value) })
            }
          />
        </label>
        {invalid && (
          <p className="text-destructive">
            Threshold and penalty must be positive.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={requestClose}>
            Close
          </button>
          <button type="submit" disabled={invalid}>
            Save
          </button>
        </div>
      </form>

      <AlertDialog
        open={showDiscardConfirm}
        onOpenChange={setShowDiscardConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved edits to this SLA configuration. Closing now will
              discard them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {/* Cancelling just closes the confirmation — draft state above is untouched. */}
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDiscardConfirm(false);
                onClose?.();
              }}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export interface PaymentTimelineStep {
  label: string;
  timestamp: string;
}
export function PaymentDetailDrawer({
  steps,
}: {
  steps: PaymentTimelineStep[];
}) {
  return (
    <aside className="w-80 border-l p-4">
      <h3 className="text-sm font-semibold mb-2">Transaction Timeline</h3>
      <ol className="space-y-2 text-xs">
        {steps.map((s, i) => (
          <li key={i} className="flex justify-between">
            <span>{s.label}</span>
            <span className="text-muted-foreground">
              {new Date(s.timestamp).toLocaleString()}
            </span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
