/**
 * retryPolicy.ts
 *
 * HTTP request timeout and retry policy for the NOC IQ API client.
 *
 * Rules enforced here:
 *   - Every request is aborted if it does not complete within REQUEST_TIMEOUT_MS
 *     (10 000 ms by default, overridable via the options argument).
 *   - Safe/idempotent GET requests are retried up to MAX_GET_RETRIES (2) times
 *     with an exponential back-off starting at RETRY_BASE_DELAY_MS (1 000 ms).
 *   - Mutating methods (POST, PUT, PATCH, DELETE) are NEVER retried to prevent
 *     duplicate side-effects on the server.
 *   - The caller receives a plain fetch Response on success, or a typed
 *     RetryPolicyError on final failure.
 *
 * Closes #716 – UI Resilience: Add HTTP request timeout and retry policy
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Milliseconds before a request is aborted. */
export const REQUEST_TIMEOUT_MS = 10_000;

/** Maximum retry attempts for idempotent GET requests. */
export const MAX_GET_RETRIES = 2;

/** Initial delay between the first failure and the first retry. */
export const RETRY_BASE_DELAY_MS = 1_000;

/** Methods that must not be retried. */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// ─── Types ────────────────────────────────────────────────────────────────────

export type ErrorClass =
  | "timeout"
  | "serverError"
  | "auth"
  | "validation"
  | "network";

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  backoffMultiplier: number;
}

export interface FetchWithRetryOptions {
  /** Override the per-request timeout (default: REQUEST_TIMEOUT_MS). */
  timeoutMs?: number;
  /** Override max retries for GET requests (default: MAX_GET_RETRIES). */
  maxRetries?: number;
  /** Additional RequestInit options forwarded to fetch(). */
  fetchInit?: RequestInit;
}

/** Error thrown when all retry attempts are exhausted or a non-retryable error occurs. */
export class RetryPolicyError extends Error {
  readonly cause: unknown;
  readonly attempts: number;
  readonly timedOut: boolean;

  constructor({
    message,
    cause,
    attempts,
    timedOut = false,
  }: {
    message: string;
    cause: unknown;
    attempts: number;
    timedOut?: boolean;
  }) {
    super(message);
    this.name = "RetryPolicyError";
    this.cause = cause;
    this.attempts = attempts;
    this.timedOut = timedOut;
  }
}

// ─── Existing policy table (backward-compatible) ──────────────────────────────

const policies: Record<ErrorClass, RetryConfig> = {
  timeout: { maxRetries: 3, baseDelayMs: 1000, backoffMultiplier: 2 },
  serverError: { maxRetries: 3, baseDelayMs: 2000, backoffMultiplier: 2 },
  auth: { maxRetries: 0, baseDelayMs: 0, backoffMultiplier: 1 },
  validation: { maxRetries: 0, baseDelayMs: 0, backoffMultiplier: 1 },
  network: { maxRetries: 2, baseDelayMs: 1000, backoffMultiplier: 2 },
};

export function getRetryConfig(errorClass: ErrorClass): RetryConfig {
  return policies[errorClass] ?? policies.network;
}

export function classifyError(status?: number, code?: string): ErrorClass {
  if (!status && code === "ECONNABORTED") return "timeout";
  if (!status) return "network";
  if (status === 401 || status === 403) return "auth";
  if (status === 422) return "validation";
  if (status >= 500) return "serverError";
  return "network";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true when the HTTP method is safe/idempotent and may be retried. */
export function isRetryableMethod(method: string): boolean {
  return !MUTATING_METHODS.has(method.toUpperCase());
}

/** Resolves after `ms` milliseconds. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Computes the exponential back-off delay for the given attempt number.
 *
 *   attempt 1 → 1 000 ms
 *   attempt 2 → 2 000 ms
 *   attempt 3 → 4 000 ms
 */
export function backoffDelay(
  attempt: number,
  baseMs: number = RETRY_BASE_DELAY_MS,
): number {
  return baseMs * Math.pow(2, attempt - 1);
}

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * fetchWithTimeoutAndRetry
 *
 * Wraps the native `fetch` API with:
 *   1. A per-request AbortSignal timeout (default 10 s).
 *   2. Automatic retry with exponential back-off for GET requests (max 2 retries).
 *   3. No retry for POST / PUT / PATCH / DELETE to prevent duplicate submissions.
 *
 * @param url     The resource URL.
 * @param options Timeout, retry, and fetch init overrides.
 * @returns       The resolved `Response` on success.
 * @throws        `RetryPolicyError` when all attempts fail.
 *
 * @example
 * ```ts
 * const res = await fetchWithTimeoutAndRetry('/api/v1/outages');
 * const data = await res.json();
 * ```
 */
export async function fetchWithTimeoutAndRetry(
  url: string | URL,
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const {
    timeoutMs = REQUEST_TIMEOUT_MS,
    fetchInit = {},
  } = options;

  const method = (fetchInit.method ?? "GET").toUpperCase();
  const canRetry = isRetryableMethod(method);
  const maxAttempts = canRetry
    ? 1 + (options.maxRetries ?? MAX_GET_RETRIES)
    : 1;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Create a fresh AbortController for every attempt so previous timeouts
    // do not bleed into subsequent retries.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchInit,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;

      const isTimeout =
        err instanceof Error &&
        (err.name === "AbortError" || err.name === "TimeoutError");

      // Do not retry if:
      //   • The method is mutating (already canRetry=false so maxAttempts=1).
      //   • This was the final allowed attempt.
      if (!canRetry || attempt === maxAttempts) {
        throw new RetryPolicyError({
          message: isTimeout
            ? `Request to ${url} timed out after ${timeoutMs} ms`
            : `Request to ${url} failed after ${attempt} attempt(s): ${err instanceof Error ? err.message : String(err)}`,
          cause: err,
          attempts: attempt,
          timedOut: isTimeout,
        });
      }

      // Exponential back-off before the next retry attempt.
      await delay(backoffDelay(attempt));
    }
  }

  // Unreachable — TypeScript requires a return/throw after the loop.
  throw new RetryPolicyError({
    message: `Request to ${url} failed`,
    cause: lastError,
    attempts: maxAttempts,
  });
}
