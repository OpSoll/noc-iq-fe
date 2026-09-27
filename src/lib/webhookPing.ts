/**
 * Result classification for a manual webhook test ping.
 *
 * A ping is the only way to check a receiver without provoking a real outage,
 * so the result has to be unambiguous: which status came back, and whether the
 * receiver accepted it. Anything outside 2xx is a failure, including 3xx —
 * a redirect means the endpoint is not delivering where the operator thinks.
 *
 * Closes #668 — manual test ping button in webhook list.
 */

export interface PingResult {
  ok: boolean;
  statusCode: number;
  latencyMs: number;
  /** `200 OK` style label, or a description when there was no response. */
  statusLabel: string;
  /** Message suitable for a toast. */
  message: string;
  /** Longer explanation shown inline beneath the button. */
  detail: string;
}

const REASONS: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  410: 'Gone',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

/** Whether a status code means the receiver accepted the ping. */
export function isPingSuccessful(statusCode: number): boolean {
  return Number.isFinite(statusCode) && statusCode >= 200 && statusCode < 300;
}

export function formatPingStatus(statusCode: number): string {
  if (!Number.isFinite(statusCode)) return 'No response';
  const reason = REASONS[statusCode];
  return reason ? `${statusCode} ${reason}` : `HTTP ${statusCode}`;
}

/** Builds the user-facing result model for a ping attempt. */
export function buildPingResult(
  statusCode: number,
  latencyMs: number
): PingResult {
  const statusLabel = formatPingStatus(statusCode);
  const ok = isPingSuccessful(statusCode);
  const latency = Number.isFinite(latencyMs) ? Math.max(0, Math.round(latencyMs)) : 0;

  if (ok) {
    return {
      ok: true,
      statusCode,
      latencyMs: latency,
      statusLabel,
      message: `Ping successful: ${statusLabel}`,
      detail: `The receiver responded in ${latency}ms. It is accepting deliveries.`,
    };
  }

  return {
    ok: false,
    statusCode,
    latencyMs: latency,
    statusLabel,
    message: `Ping failed: ${statusLabel}`,
    detail:
      statusCode >= 300 && statusCode < 400
        ? 'The endpoint redirected instead of accepting the delivery. Point the webhook at the final URL.'
        : 'The receiver did not accept the test ping. Check its availability and signature verification before relying on it.',
  };
}

/** Builds the result model for a ping that never reached the endpoint. */
export function buildPingError(message: string): PingResult {
  return {
    ok: false,
    statusCode: 0,
    latencyMs: 0,
    statusLabel: 'Unreachable',
    message: 'Ping failed: endpoint unreachable',
    detail: message || 'The endpoint could not be reached.',
  };
}
