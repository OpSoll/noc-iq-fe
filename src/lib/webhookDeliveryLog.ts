import type { WebhookDelivery } from '@/types/webhook';

/**
 * Classification and formatting for the delivery history inspector.
 *
 * Split out of the drawer so status-label mapping and header/body
 * normalisation can be tested directly — the drawer's own tests should not
 * need to re-assert what "502" renders as.
 *
 * Closes #664 — webhook delivery history log inspector drawer.
 */

export type DeliveryHttpCategory = 'success' | 'client_error' | 'server_error' | 'unknown';

export interface DeliveryHttpStatus {
  code: number | null;
  category: DeliveryHttpCategory;
  /** Short label such as `200 OK` or `500 Error`. */
  label: string;
  /** Bare reason phrase, e.g. `Not Found`. */
  reason: string;
}

const REASONS: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

const GENERIC_REASONS: Record<DeliveryHttpCategory, string> = {
  success: 'Success',
  client_error: 'Error',
  server_error: 'Error',
  unknown: 'No response',
};

/** Maps a delivery to its HTTP status presentation. */
export function getDeliveryHttpStatus(
  delivery: WebhookDelivery
): DeliveryHttpStatus {
  const code = delivery.response_code;

  if (typeof code !== 'number' || !Number.isFinite(code)) {
    return { code: null, category: 'unknown', label: 'No response', reason: 'No response' };
  }

  let category: DeliveryHttpCategory;
  if (code >= 200 && code < 300) category = 'success';
  else if (code >= 400 && code < 500) category = 'client_error';
  else if (code >= 500) category = 'server_error';
  else category = 'unknown';

  const reason = REASONS[code] ?? GENERIC_REASONS[category];
  return { code, category, label: `${code} ${reason}`, reason };
}

export const HTTP_CATEGORY_CLASSES: Record<DeliveryHttpCategory, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  client_error: 'border-amber-200 bg-amber-50 text-amber-700',
  server_error: 'border-red-200 bg-red-50 text-red-700',
  unknown: 'border-slate-200 bg-slate-50 text-slate-500',
};

/** Attempt count for a delivery, tolerating a missing or malformed value. */
export function getDeliveryAttemptCount(delivery: WebhookDelivery): number {
  const raw = (delivery as WebhookDelivery & { attempts?: unknown }).attempts;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.trunc(raw));
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw);
  return 1;
}

/** Round-trip latency in milliseconds, when the platform recorded one. */
export function getDeliveryLatencyMs(delivery: WebhookDelivery): number | null {
  const raw = (delivery as WebhookDelivery & { latency_ms?: unknown }).latency_ms;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, raw);
  if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) {
    return Math.max(0, Number(raw));
  }
  return null;
}

export interface DeliveryHeaders {
  request: Array<[string, string]>;
  response: Array<[string, string]>;
}

/**
 * Extracts request/response headers for the expanded row.
 *
 * Accepts either a plain record or an entry array, and drops any header whose
 * name is sensitive so a signature or authorization value is not rendered into
 * the inspector. The backend redacts these too; this is the second layer.
 */
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-signature',
  'x-webhook-signature',
]);

export function getDeliveryHeaders(
  delivery: WebhookDelivery
): DeliveryHeaders {
  const extended = delivery as WebhookDelivery & {
    request_headers?: unknown;
    response_headers?: unknown;
  };

  return {
    request: toHeaderEntries(extended.request_headers),
    response: toHeaderEntries(extended.response_headers),
  };
}

function toHeaderEntries(raw: unknown): Array<[string, string]> {
  if (Array.isArray(raw)) {
    return raw
      .filter((entry): entry is [string, string] => Array.isArray(entry) && entry.length === 2)
      .map(([name, value]) => [String(name), String(value)] as [string, string])
      .filter(([name]) => !SENSITIVE_HEADERS.has(name.toLowerCase()));
  }

  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .map(([name, value]) => [name, String(value)] as [string, string])
      .filter(([name]) => !SENSITIVE_HEADERS.has(name.toLowerCase()));
  }

  return [];
}

/** Pretty-prints a payload body, tolerating values that are not JSON. */
export function formatBody(body: unknown): string {
  if (body === undefined || body === null || body === '') return '—';
  if (typeof body === 'string') {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      // Not JSON — show it verbatim.
      return body;
    }
  }
  try {
    return JSON.stringify(body, null, 2);
  } catch {
    return String(body);
  }
}

/** Formats a timestamp for the log list. */
export function formatDeliveryTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'UTC',
  }).format(date);
}
