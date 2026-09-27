'use client';

import { useState } from 'react';

import { useToast } from '@/components/ui/toast';
import { buildPingError, buildPingResult, type PingResult } from '@/lib/webhookPing';
import { cn } from '@/lib/utils';

/**
 * Sends a test ping to a registered endpoint without provoking an outage.
 *
 * Operators otherwise have to trust that a receiver works until the first real
 * event, by which time the outage it would have reported is already over.
 *
 * Closes #668 — manual test ping button in webhook list.
 */

export interface PingButtonProps {
  /** Endpoint to ping. */
  webhookId: string;
  url: string;
  /** Performs the ping; returns the HTTP status code and round-trip latency. */
  onPing: (webhookId: string) => Promise<{ statusCode: number; latencyMs: number }>;
  className?: string;
}

export default function PingButton({
  webhookId,
  url,
  onPing,
  className,
}: PingButtonProps) {
  const toast = useToast();
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<PingResult | null>(null);

  const handlePing = async () => {
    if (isPending) return;
    setIsPending(true);
    setResult(null);
    try {
      const { statusCode, latencyMs } = await onPing(webhookId);
      const built = buildPingResult(statusCode, latencyMs);
      setResult(built);
      toast(built.message, built.ok ? 'success' : 'error');
    } catch (err) {
      const built = buildPingError(
        err instanceof Error ? err.message : 'Unknown error'
      );
      setResult(built);
      toast(built.message, 'error');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className={cn('space-y-1', className)}>
      <button
        type="button"
        onClick={() => void handlePing()}
        disabled={isPending}
        data-testid="webhook-ping-button"
        aria-busy={isPending}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        {isPending && (
          <span
            data-testid="webhook-ping-spinner"
            aria-hidden="true"
            className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 motion-reduce:animate-none"
          />
        )}
        {isPending ? 'Pinging…' : 'Send Test Ping'}
      </button>

      {result && (
        <p
          role={result.ok ? 'status' : 'alert'}
          data-testid="webhook-ping-result"
          data-ok={result.ok ? 'true' : 'false'}
          title={url}
          className={cn(
            'text-xs',
            result.ok ? 'text-emerald-700' : 'text-red-700'
          )}
        >
          {result.message}
          <span className="block text-slate-500">{result.detail}</span>
        </p>
      )}
    </div>
  );
}
