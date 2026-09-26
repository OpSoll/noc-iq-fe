import type { WebhookDelivery } from '@/types/webhook';

/** HTTP status-code buckets used by the delivery-log status filter. */
export type DeliveryStatusCategory = 'all' | '2xx' | '4xx' | '5xx';

export interface DeliveryLogFilters {
  /** Free-text query matched against event ID, URL, and error text. */
  search: string;
  /** HTTP status category derived from `response_code`. */
  statusCategory: DeliveryStatusCategory;
  /** Event topic (e.g. `outage.created`); `'all'` disables the filter. */
  eventTopic: string;
  /** Calendar date (`YYYY-MM-DD`) matched against `created_at`; empty disables. */
  date: string;
}

export const EMPTY_DELIVERY_LOG_FILTERS: DeliveryLogFilters = {
  search: '',
  statusCategory: 'all',
  eventTopic: 'all',
  date: '',
};

export function isDeliveryLogFilterActive(
  filters: DeliveryLogFilters
): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.statusCategory !== 'all' ||
    filters.eventTopic !== 'all' ||
    filters.date !== ''
  );
}

/** Maps an HTTP status code to its filter bucket. Codes outside 2xx/4xx/5xx
 * (including missing codes) fall into `'other'` and only match `'all'`. */
export function statusCategoryOf(
  code: number | null | undefined
): '2xx' | '4xx' | '5xx' | 'other' {
  if (typeof code !== 'number') return 'other';
  if (code >= 200 && code < 300) return '2xx';
  if (code >= 400 && code < 500) return '4xx';
  if (code >= 500 && code < 600) return '5xx';
  return 'other';
}

function safeStringify(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Predicate + collection filter for webhook delivery logs.
 *
 * A delivery matches when ALL active filters match:
 * - `search`: case-insensitive substring match against the delivery ID, the
 *   parent webhook URL (`opts.webhookUrl`), the event topic, the delivery
 *   `status`, the response code, and the stringified request/response bodies
 *   (where error text surfaces).
 * - `statusCategory`: HTTP bucket derived from `response_code`.
 * - `eventTopic`: exact event-topic match (`'all'` disables).
 * - `date`: `created_at` calendar-date prefix (`YYYY-MM-DD`; empty disables).
 *
 * Clearing all filters restores the full delivery log view.
 */
export function matchesDeliveryLog(
  delivery: WebhookDelivery,
  filters: DeliveryLogFilters,
  opts?: { webhookUrl?: string }
): boolean {
  if (
    filters.statusCategory !== 'all' &&
    statusCategoryOf(delivery.response_code) !== filters.statusCategory
  ) {
    return false;
  }

  if (filters.eventTopic !== 'all' && delivery.event !== filters.eventTopic) {
    return false;
  }

  if (filters.date && !delivery.created_at.startsWith(filters.date)) {
    return false;
  }

  const query = filters.search.trim().toLowerCase();
  if (query) {
    const haystack = [
      delivery.id,
      delivery.event,
      delivery.status,
      delivery.response_code != null ? String(delivery.response_code) : '',
      opts?.webhookUrl ?? '',
      safeStringify(delivery.request_body),
      safeStringify(delivery.response_body),
    ]
      .join('\n')
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  return true;
}

export function filterDeliveryLogs(
  deliveries: WebhookDelivery[],
  filters: DeliveryLogFilters,
  opts?: { webhookUrl?: string }
): WebhookDelivery[] {
  if (!isDeliveryLogFilterActive(filters)) return deliveries;
  return deliveries.filter((d) => matchesDeliveryLog(d, filters, opts));
}
