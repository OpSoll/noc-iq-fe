'use client';

import { useEffect, useId, useState } from 'react';

import Modal from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { getDeleteConfirmState, getEndpointLabel } from '@/lib/webhookDelete';
import type { Webhook } from '@/types/webhook';

/**
 * Confirmation step before deleting a webhook endpoint.
 *
 * Requires the operator to type the endpoint identifier, which both prevents a
 * reflexive delete and confirms they have read *which* receiver is about to
 * stop delivering. Deletion is immediate and not reversible, and the silence
 * that follows is the dangerous part.
 *
 * Closes #672 — webhook endpoint deletion confirmation modal.
 */

export interface DeleteWebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Endpoint being deleted. */
  webhook: Webhook;
  /** Performs the deletion; the modal owns the confirmation, not transport. */
  onDelete: (webhookId: string) => Promise<void> | void;
  isDeleting?: boolean;
}

export default function DeleteWebhookModal({
  isOpen,
  onClose,
  webhook,
  onDelete,
  isDeleting = false,
}: DeleteWebhookModalProps) {
  const toast = useToast();
  const id = useId();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  const label = getEndpointLabel(webhook.url);
  const state = getDeleteConfirmState(typed, label);

  // Never carry a previous confirmation into a reopened modal.
  useEffect(() => {
    if (isOpen) {
      setTyped('');
      setError(null);
    }
  }, [isOpen, webhook.id]);

  const handleDelete = async () => {
    if (!state.canDelete) {
      setError(state.message);
      return;
    }
    try {
      await onDelete(webhook.id);
      toast('Webhook endpoint deleted', 'success');
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not delete the endpoint';
      setError(message);
      toast(message, 'error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete webhook endpoint"
      maxWidth="max-w-lg"
      disableBackdropClose
    >
      <div className="space-y-4">
        <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-200 font-bold text-red-900"
          >
            !
          </span>
          <div className="space-y-1 text-sm text-red-900">
            <p className="font-semibold">
              This stops all deliveries to{' '}
              <span className="font-mono break-all">{webhook.url}</span>
            </p>
            <p>
              Any outage, SLA, or payment alerts this receiver was handling
              will stop immediately. Deletion cannot be undone — you would need
              to register the endpoint again and rotate its secret.
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <label
            htmlFor={`${id}-confirm`}
            className="block text-sm font-medium text-slate-700"
          >
            Type{' '}
            <span data-testid="delete-confirm-label" className="font-mono">
              {label}
            </span>{' '}
            to confirm
          </label>
          <input
            id={`${id}-confirm`}
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
              if (error) setError(null);
            }}
            onBlur={() => setError(state.message)}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={typed.length > 0 && !state.isConfirmed}
            aria-describedby={error ? `${id}-error` : undefined}
            data-testid="delete-confirm-input"
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          />
          {error && (
            <p
              id={`${id}-error`}
              role="alert"
              data-testid="delete-confirm-error"
              className="text-xs text-red-700"
            >
              {error}
            </p>
          )}
        </div>

        <p className="text-xs text-slate-500">
          Subscribed topics:{' '}
          <span className="font-mono">
            {webhook.events.length > 0 ? webhook.events.join(', ') : 'none'}
          </span>
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={!state.canDelete || isDeleting}
            data-testid="delete-confirm-button"
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            {isDeleting ? 'Deleting…' : 'Delete endpoint'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
