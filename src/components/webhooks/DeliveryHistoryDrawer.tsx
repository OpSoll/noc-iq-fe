'use client';

import { useMemo, useState } from 'react';

import {
  formatBody,
  formatDeliveryTime,
  getDeliveryAttemptCount,
  getDeliveryHeaders,
  getDeliveryHttpStatus,
  getDeliveryLatencyMs,
  HTTP_CATEGORY_CLASSES,
} from '@/lib/webhookDeliveryLog';
import type { WebhookDelivery } from '@/types/webhook';
import { cn } from '@/lib/utils';

/**
 * Inspector for a webhook's past HTTP dispatches.
 *
 * Debugging a failed delivery otherwise means correlating timestamps against
 * the backend's own logs. The drawer keeps the status code, latency, attempt
 * count, and both bodies next to each other, and allows a failed dispatch to be
 * replayed without leaving the console.
 *
 * Closes #664 — webhook delivery history log inspector drawer.
 */

export interface DeliveryHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Dispatches to inspect, newest first. */
  deliveries: WebhookDelivery[];
  /** URL of the endpoint the dispatches belong to, shown in the header. */
  webhookUrl?: string;
  /** Re-sends a dispatch's payload; the drawer owns expansion, not transport. */
  onResend?: (delivery: WebhookDelivery) => Promise<void> | void;
  /** Disables the list while more dispatches load. */
  isLoading?: boolean;
}

export default function DeliveryHistoryDrawer({
  isOpen,
  onClose,
  deliveries,
  webhookUrl,
  onResend,
  isLoading = false,
}: DeliveryHistoryDrawerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      deliveries.map((delivery) => ({
        delivery,
        http: getDeliveryHttpStatus(delivery),
        latencyMs: getDeliveryLatencyMs(delivery),
        attempts: getDeliveryAttemptCount(delivery),
        headers: getDeliveryHeaders(delivery),
      })),
    [deliveries]
  );

  if (!isOpen) return null;

  const handleResend = async (delivery: WebhookDelivery) => {
    if (!onResend) return;
    setResendingId(delivery.id);
    try {
      await onResend(delivery);
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      {/* Backdrop */}
      <div
        data-backdrop=""
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-drawer-title"
        data-testid="delivery-history-drawer"
        className="relative flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-4">
          <div className="min-w-0">
            <h2
              id="delivery-drawer-title"
              className="text-base font-semibold text-slate-900"
            >
              Delivery history
            </h2>
            {webhookUrl && (
              <p className="truncate font-mono text-xs text-slate-500">
                {webhookUrl}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close delivery history"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <p className="p-4 text-sm text-slate-400">Loading dispatches…</p>
          )}

          {!isLoading && rows.length === 0 && (
            <p className="p-4 text-sm text-slate-400">
              No dispatches recorded for this endpoint yet.
            </p>
          )}

          <ul data-testid="delivery-log-list">
            {rows.map(({ delivery, http, latencyMs, attempts, headers }) => {
              const expanded = expandedId === delivery.id;
              return (
                <li
                  key={delivery.id}
                  data-testid="delivery-log-row"
                  className="border-b border-slate-100 last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : delivery.id)}
                    aria-expanded={expanded}
                    data-testid="delivery-log-toggle"
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                  >
                    <span
                      data-testid="delivery-status-badge"
                      data-category={http.category}
                      className={cn(
                        'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-mono text-xs font-medium',
                        HTTP_CATEGORY_CLASSES[http.category]
                      )}
                    >
                      {http.label}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {delivery.event}
                      </span>
                      <span className="block font-mono text-xs text-slate-500">
                        {formatDeliveryTime(delivery.created_at)}
                        {latencyMs !== null && ` · ${Math.round(latencyMs)}ms`}
                        {` · attempt ${attempts}`}
                      </span>
                    </span>
                  </button>

                  {expanded && (
                    <div
                      data-testid="delivery-log-detail"
                      className="space-y-3 border-t border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <HeaderList
                        title="Request headers"
                        entries={headers.request}
                        empty="No request headers recorded."
                      />
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Request body
                        </h3>
                        <pre
                          data-testid="delivery-request-body"
                          className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2 font-mono text-xs text-slate-700"
                        >
                          {formatBody(delivery.request_body)}
                        </pre>
                      </div>
                      <HeaderList
                        title="Response headers"
                        entries={headers.response}
                        empty="No response headers recorded."
                      />
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Response body
                        </h3>
                        <pre
                          data-testid="delivery-response-body"
                          className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2 font-mono text-xs text-slate-700"
                        >
                          {formatBody(delivery.response_body)}
                        </pre>
                      </div>

                      {onResend && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => void handleResend(delivery)}
                            disabled={resendingId === delivery.id}
                            data-testid="delivery-resend-button"
                            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                          >
                            {resendingId === delivery.id
                              ? 'Re-sending…'
                              : 'Re-send Payload'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function HeaderList({
  title,
  entries,
  empty,
}: {
  title: string;
  entries: Array<[string, string]>;
  empty: string;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      {entries.length === 0 ? (
        <p className="mt-1 text-xs text-slate-400">{empty}</p>
      ) : (
        <dl className="mt-1 space-y-0.5 rounded bg-white p-2 font-mono text-xs">
          {entries.map(([name, value]) => (
            <div key={name} className="flex gap-2">
              <dt className="shrink-0 text-slate-500">{name}:</dt>
              <dd className="min-w-0 break-all text-slate-700">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
