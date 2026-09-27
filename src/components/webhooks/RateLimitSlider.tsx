'use client';

import { useState } from 'react';

import { useToast } from '@/components/ui/toast';
import {
  assessRateLimit,
  formatRateLimit,
  MAX_RATE_LIMIT,
  MIN_RATE_LIMIT,
  RATE_LIMIT_STEP,
  RATE_LIMIT_TICKS,
} from '@/lib/webhookRateLimit';
import { cn } from '@/lib/utils';

/**
 * Per-endpoint ceiling on outbound dispatches.
 *
 * Bounds the blast radius of a receiver that cannot keep up: without it, one
 * endpoint's retry backlog can delay events for every other endpoint.
 *
 * Closes #671 — outbound rate limit configuration slider.
 */

export interface RateLimitSliderProps {
  /** Endpoint the limit applies to. */
  webhookId: string;
  /** Current persisted value. */
  value: number;
  /** Persists the new limit; rejects to keep the control in its previous state. */
  onSave: (webhookId: string, rateLimit: number) => Promise<void> | void;
  className?: string;
}

export default function RateLimitSlider({
  webhookId,
  value,
  onSave,
  className,
}: RateLimitSliderProps) {
  const toast = useToast();
  const [draft, setDraft] = useState(value);
  const [isSaving, setIsSaving] = useState(false);

  const assessment = assessRateLimit(draft);
  const isDirty = draft !== value;

  const handleSave = async () => {
    if (!assessment.isValid || isSaving) return;
    setIsSaving(true);
    try {
      await onSave(webhookId, assessment.clamped);
      toast(`Rate limit saved: ${formatRateLimit(assessment.clamped)}`, 'success');
    } catch (err) {
      toast(
        err instanceof Error ? err.message : 'Could not save the rate limit',
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={cn(
        'space-y-2 rounded-lg border border-slate-200 p-3',
        className
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={`rate-limit-${webhookId}`}
          className="text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          Outbound rate limit
        </label>
        <span
          data-testid="rate-limit-value"
          className="font-mono text-sm font-semibold text-slate-800"
        >
          {formatRateLimit(assessment.clamped)}
        </span>
      </div>

      <input
        id={`rate-limit-${webhookId}`}
        type="range"
        min={MIN_RATE_LIMIT}
        max={MAX_RATE_LIMIT}
        step={RATE_LIMIT_STEP}
        value={assessment.clamped}
        onChange={(e) => setDraft(Number(e.target.value))}
        disabled={isSaving}
        data-testid="rate-limit-slider"
        aria-describedby={`rate-limit-help-${webhookId}`}
        aria-valuetext={formatRateLimit(assessment.clamped)}
        className="w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      />

      <div className="flex justify-between px-0.5 text-[10px] text-slate-400">
        {RATE_LIMIT_TICKS.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>

      <p
        id={`rate-limit-help-${webhookId}`}
        data-testid="rate-limit-help"
        className="text-xs text-slate-500"
      >
        Caps this endpoint at {assessment.clamped} dispatches per second (
        {assessment.clamped * 3600} per hour). Raising it above the receiver's
        real capacity only deepens its backlog.
      </p>

      {assessment.message && (
        <p
          role={assessment.isValid ? 'status' : 'alert'}
          data-testid="rate-limit-warning"
          className={cn(
            'rounded border px-2 py-1 text-xs',
            assessment.isValid
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-red-200 bg-red-50 text-red-700'
          )}
        >
          {assessment.message}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setDraft(value)}
          disabled={!isDirty || isSaving}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!isDirty || !assessment.isValid || isSaving}
          data-testid="rate-limit-save"
          className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          {isSaving ? 'Saving…' : 'Save limit'}
        </button>
      </div>
    </div>
  );
}
