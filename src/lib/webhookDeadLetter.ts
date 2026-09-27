import type { WebhookDelivery } from '@/types/webhook';

/**
 * Dead-letter queue selection and batch-action rules.
 *
 * A dispatch only lands here once it has exhausted its retries, so the queue
 * is small and high-signal — which makes bulk actions genuinely useful and
 * also genuinely risky. Replaying a whole page of dead letters can hammer a
 * receiver that was disabled *because* it was failing, and purging is
 * irreversible. Both operations are therefore gated here, with the reason
 * available to the UI, rather than in each call site.
 *
 * Closes #665 — dead-letter queue management table with batch replay.
 */

export interface DeadLetterItem {
  id: string;
  webhookId: string;
  webhookUrl: string;
  event: string;
  /** Human-readable failure reason, e.g. `503 Service Unavailable`. */
  error: string;
  /** How many delivery attempts were made before giving up. */
  attempts: number;
  /** When the dispatch was last attempted. */
  lastAttemptAt: string;
  /** The payload that failed, replayable as-is. */
  payload?: unknown;
}

export interface BatchActionState {
  canReplay: boolean;
  canPurge: boolean;
  /** Reasons an action is unavailable, for display next to a disabled button. */
  replayBlockedReason: string | null;
  purgeBlockedReason: string | null;
}

export const MAX_PURGE_SELECTION = 200;

/** Turns raw dispatch records into queue rows, dropping anything not exhausted. */
export function toDeadLetterItems(
  deliveries: WebhookDelivery[],
  options: { webhookUrl?: string; exhaustedAttempts?: number } = {}
): DeadLetterItem[] {
  const { webhookUrl = '', exhaustedAttempts = 5 } = options;

  return deliveries
    .filter((delivery) => {
      const attempts = getAttempts(delivery);
      if (attempts < exhaustedAttempts) return false;
      return delivery.status === 'failed' || getResponseCode(delivery) >= 400;
    })
    .map((delivery) => {
      const code = getResponseCode(delivery);
      return {
        id: delivery.id,
        webhookId: delivery.webhook_id,
        webhookUrl,
        event: delivery.event,
        error: code > 0 ? `HTTP ${code}` : (delivery.status ?? 'failed'),
        attempts: getAttempts(delivery),
        lastAttemptAt: delivery.created_at,
        payload: delivery.request_body,
      };
    });
}

function getAttempts(delivery: WebhookDelivery): number {
  const raw = (delivery as WebhookDelivery & { attempts?: unknown }).attempts;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.trunc(raw));
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw);
  return 1;
}

function getResponseCode(delivery: WebhookDelivery): number {
  const code = delivery.response_code;
  return typeof code === 'number' && Number.isFinite(code) ? code : 0;
}

/**
 * Decides whether the batch action bar's actions are available.
 *
 * Replay is blocked on an empty selection. Purge is additionally blocked past
 * `MAX_PURGE_SELECTION`, because an unbounded delete is one mis-click from
 * destroying the entire queue.
 */
export function getBatchActionState(
  selectedCount: number,
  isMutating = false
): BatchActionState {
  if (isMutating) {
    return {
      canReplay: false,
      canPurge: false,
      replayBlockedReason: 'Working…',
      purgeBlockedReason: 'Working…',
    };
  }

  if (selectedCount === 0) {
    return {
      canReplay: false,
      canPurge: false,
      replayBlockedReason: 'Select at least one dispatch',
      purgeBlockedReason: 'Select at least one dispatch',
    };
  }

  const overLimit = selectedCount > MAX_PURGE_SELECTION;
  return {
    canReplay: true,
    canPurge: !overLimit,
    replayBlockedReason: null,
    purgeBlockedReason: overLimit
      ? `Purge is limited to ${MAX_PURGE_SELECTION} items at a time`
      : null,
  };
}

/** Formats the time a dispatch was last attempted. */
export function formatAttemptTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date);
}
