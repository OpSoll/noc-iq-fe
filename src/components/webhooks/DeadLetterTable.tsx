'use client';

import { useMemo, useState } from 'react';

import {
  formatAttemptTime,
  getBatchActionState,
  toDeadLetterItems,
  type DeadLetterItem,
} from '@/lib/webhookDeadLetter';
import type { WebhookDelivery } from '@/types/webhook';
import { cn } from '@/lib/utils';

/**
 * Management table for webhook dispatches that exhausted their retries.
 *
 * These are the failures that are otherwise invisible — the endpoint stopped
 * trying, and the operator finds out when a downstream alert never arrives.
 * The table supports selecting and replaying a batch, and purging entries that
 * are no longer worth keeping.
 *
 * Closes #665 — dead-letter queue management table with batch replay.
 */

export interface DeadLetterTableProps {
  deliveries: WebhookDelivery[];
  /** Endpoint URL, shown per row so mixed queues stay readable. */
  webhookUrl?: string;
  onReplayBatch?: (items: DeadLetterItem[]) => Promise<void> | void;
  onPurgeSelected?: (ids: string[]) => Promise<void> | void;
  /** Attempts a dispatch may make before it is dead-lettered. */
  exhaustedAttempts?: number;
  isLoading?: boolean;
  className?: string;
}

export default function DeadLetterTable({
  deliveries,
  webhookUrl,
  onReplayBatch,
  onPurgeSelected,
  exhaustedAttempts = 5,
  isLoading = false,
  className,
}: DeadLetterTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isMutating, setIsMutating] = useState(false);

  const items = useMemo(
    () => toDeadLetterItems(deliveries, { webhookUrl, exhaustedAttempts }),
    [deliveries, webhookUrl, exhaustedAttempts]
  );

  const allSelected = items.length > 0 && selected.size === items.length;
  const actions = getBatchActionState(selected.size, isMutating);

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleReplay = async () => {
    if (!onReplayBatch || !actions.canReplay) return;
    const chosen = items.filter((item) => selected.has(item.id));
    setIsMutating(true);
    try {
      await onReplayBatch(chosen);
      setSelected(new Set());
    } finally {
      setIsMutating(false);
    }
  };

  const handlePurge = async () => {
    if (!onPurgeSelected || !actions.canPurge) return;
    const ids = items
      .filter((item) => selected.has(item.id))
      .map((item) => item.id);
    setIsMutating(true);
    try {
      await onPurgeSelected(ids);
      setSelected(new Set());
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Dead-letter queue
          </h2>
          <p className="text-xs text-slate-500">
            {items.length} exhausted dispatch{items.length === 1 ? '' : 'es'}
            {exhaustedAttempts
              ? ` after ${exhaustedAttempts} failed attempts`
              : ''}
          </p>
        </div>

        <div
          data-testid="dead-letter-actions"
          className="flex items-center gap-2 text-xs"
        >
          <span aria-live="polite" className="text-slate-500">
            {selected.size} selected
          </span>
          <button
            type="button"
            onClick={() => void handleReplay()}
            disabled={!actions.canReplay}
            title={actions.replayBlockedReason ?? undefined}
            data-testid="dead-letter-replay"
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            Replay selected
          </button>
          <button
            type="button"
            onClick={() => void handlePurge()}
            disabled={!actions.canPurge}
            title={actions.purgeBlockedReason ?? undefined}
            data-testid="dead-letter-purge"
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Purge Selected
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Webhook dispatches that exhausted their retry attempts
          </caption>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="w-10 px-4 py-2">
                <label className="sr-only" htmlFor="dead-letter-select-all">
                  Select all dead-letter dispatches
                </label>
                <input
                  id="dead-letter-select-all"
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  data-testid="dead-letter-select-all"
                  className="h-4 w-4 rounded border-slate-300"
                />
              </th>
              {['Event', 'Endpoint', 'Error', 'Retries', 'Last attempt'].map(
                (column) => (
                  <th key={column} scope="col" className="px-4 py-2 font-medium">
                    {column}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody data-testid="dead-letter-rows">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Loading dead-letter queue…
                </td>
              </tr>
            )}

            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Nothing in the dead-letter queue. All dispatches succeeded.
                </td>
              </tr>
            )}

            {!isLoading &&
              items.map((item) => (
                <tr
                  key={item.id}
                  data-testid="dead-letter-row"
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-2">
                    <label className="sr-only" htmlFor={`select-${item.id}`}>
                      Select dispatch {item.id}
                    </label>
                    <input
                      id={`select-${item.id}`}
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleOne(item.id)}
                      data-testid="dead-letter-select"
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-800">
                    {item.event}
                  </td>
                  <td
                    className="max-w-[16rem] truncate px-4 py-2 font-mono text-xs text-slate-500"
                    title={item.webhookUrl}
                  >
                    {item.webhookUrl || '—'}
                  </td>
                  <td className="px-4 py-2 text-red-700">{item.error}</td>
                  <td className="px-4 py-2 font-mono text-slate-700">
                    {item.attempts}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                    {formatAttemptTime(item.lastAttemptAt)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
