'use client';

import { useState } from 'react';

import Modal from '@/components/ui/modal';
import {
  DEFAULT_GRACE_WINDOW,
  describeGraceWindowRemaining,
  getGraceWindowOption,
  GRACE_WINDOW_OPTIONS,
  isGraceWindowHours,
  type GraceWindowHours,
} from '@/lib/secretRotation';
import type { Webhook } from '@/types/webhook';
import { cn } from '@/lib/utils';

/**
 * Initiates a webhook signing-secret rotation with a configurable grace window.
 *
 * During the grace window both the old and new secret validate incoming
 * signatures, so receivers can be updated without a gap in verification. The
 * new secret is shown once, in full, and the operator is told plainly that it
 * will not be shown again.
 *
 * Closes #666 — webhook secret key rotation modal with grace window options.
 */

export interface SecretRotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Endpoint whose secret is being rotated. */
  webhook: Webhook;
  /**
   * Called with the chosen grace window. Returning the new secret string
   * displays it once for the operator to copy.
   */
  onRotate: (
    graceWindowHours: GraceWindowHours
  ) => Promise<string | void> | string | void;
  isRotating?: boolean;
  className?: string;
}

export default function SecretRotationModal({
  isOpen,
  onClose,
  webhook,
  onRotate,
  isRotating = false,
  className,
}: SecretRotationModalProps) {
  const [graceWindow, setGraceWindow] = useState<GraceWindowHours>(
    DEFAULT_GRACE_WINDOW
  );
  const [issuedSecret, setIssuedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const inGraceWindow = Boolean(
    webhook.secondary_secret_preview && webhook.secondary_secret_expires_at
  );
  const remaining = describeGraceWindowRemaining(
    webhook.secondary_secret_expires_at
  );

  const handleRotate = async () => {
    if (!isGraceWindowHours(graceWindow)) return;
    const result = await onRotate(graceWindow);
    // The backend returns the new secret once; surface it for the operator to
    // copy, then it is never retrievable again.
    if (typeof result === 'string') {
      setIssuedSecret(result);
    }
  };

  const handleCopy = async () => {
    if (!issuedSecret) return;
    try {
      await navigator.clipboard.writeText(issuedSecret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Rotate signing secret"
      maxWidth="max-w-lg"
      disableBackdropClose
    >
      <div className={cn('space-y-4', className)}>
        <p className="text-sm text-slate-600">
          Generating a new signing secret. With a grace window the current
          secret keeps validating alongside the new one, so receivers are not
          broken mid-rotation.
        </p>

        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-600">Current secret</p>
          <code
            data-testid="secret-rotation-current"
            className="block rounded border bg-slate-50 px-2 py-1 font-mono text-xs text-slate-700"
          >
            {webhook.secret_preview ?? 'whsec_••••••••'}
          </code>
        </div>

        {inGraceWindow && (
          <div
            data-testid="secret-rotation-dual-signature-badge"
            className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
          >
            <span className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-xs font-medium text-amber-800">
              Dual signatures active
            </span>
            {remaining && (
              <span className="text-xs text-amber-700">{remaining}</span>
            )}
          </div>
        )}

        <fieldset className="space-y-1">
          <legend className="text-sm font-medium text-slate-700">
            Grace window
          </legend>
          {GRACE_WINDOW_OPTIONS.map((option) => (
            <label
              key={option.value}
              data-testid={`grace-window-${option.value}`}
              className={cn(
                'flex cursor-pointer gap-2 rounded-md border p-2',
                graceWindow === option.value
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-slate-200 hover:bg-slate-50'
              )}
            >
              <input
                type="radio"
                name="secret-grace-window"
                value={option.value}
                checked={graceWindow === option.value}
                onChange={() => setGraceWindow(option.value)}
                className="mt-0.5 h-4 w-4"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800">
                  {option.label}
                </span>
                <span className="block text-xs text-slate-500">
                  {option.description}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        {issuedSecret && (
          <div className="space-y-1 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-semibold text-emerald-800">
              New secret — copy it now, it will not be shown again
            </p>
            <code
              data-testid="secret-rotation-new-secret"
              className="block break-all rounded bg-white px-2 py-1 font-mono text-xs text-slate-800"
            >
              {issuedSecret}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              data-testid="secret-rotation-copy"
              className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-white"
            >
              {copied ? 'Copied' : 'Copy new secret'}
            </button>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => void handleRotate()}
            disabled={isRotating || Boolean(issuedSecret)}
            data-testid="secret-rotation-submit"
            className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
          >
            {isRotating
              ? 'Rotating…'
              : getGraceWindowOption(graceWindow)?.value === 0
                ? 'Rotate immediately'
                : 'Rotate secret'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
