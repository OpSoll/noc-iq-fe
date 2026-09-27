/**
 * Outbound rate-limit rules for a webhook endpoint.
 *
 * A receiver that cannot keep up with an event burst degrades badly: the
 * dispatcher fills its queue, retries pile up, and events for *other* endpoints
 * are delayed behind them. An explicit per-endpoint ceiling bounds that blast
 * radius. The recommended minimum exists because below roughly 10 requests per
 * second a receiver that was already struggling is usually being handed a
 * pattern it cannot absorb, whatever the operator intended.
 *
 * Closes #671 — outbound rate limit configuration slider.
 */

export const MIN_RATE_LIMIT = 5;
export const MAX_RATE_LIMIT = 100;
export const RECOMMENDED_MIN_RATE_LIMIT = 10;
export const DEFAULT_RATE_LIMIT = 25;

export interface RateLimitAssessment {
  value: number;
  isValid: boolean;
  /** Below the recommended minimum; the operator is warned but not blocked. */
  isBelowRecommended: boolean;
  /** Clamped display value. */
  clamped: number;
  message: string | null;
}

export function clampRateLimit(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_RATE_LIMIT;
  return Math.min(MAX_RATE_LIMIT, Math.max(MIN_RATE_LIMIT, Math.round(value)));
}

/** True when the value sits inside the supported range. */
export function isValidRateLimit(value: number): boolean {
  return (
    Number.isFinite(value) && value >= MIN_RATE_LIMIT && value <= MAX_RATE_LIMIT
  );
}

/** True when the value is valid but below the recommended minimum. */
export function isBelowRecommendedRateLimit(value: number): boolean {
  return isValidRateLimit(value) && value < RECOMMENDED_MIN_RATE_LIMIT;
}

export function assessRateLimit(value: number): RateLimitAssessment {
  const clamped = clampRateLimit(value);
  const isValid = isValidRateLimit(value);
  const isBelowRecommended = isBelowRecommendedRateLimit(value);

  let message: string | null = null;
  if (!isValid) {
    message = `Rate limit must be between ${MIN_RATE_LIMIT} and ${MAX_RATE_LIMIT} requests per second.`;
  } else if (isBelowRecommended) {
    message = `Below the recommended minimum of ${RECOMMENDED_MIN_RATE_LIMIT} req/s. If this receiver is already struggling, a lower ceiling will not help it catch up — it will widen the delivery backlog.`;
  }

  return { value, isValid, isBelowRecommended, clamped, message };
}

/** Snapshots for the slider ticks. */
export const RATE_LIMIT_TICKS = [
  MIN_RATE_LIMIT,
  25,
  50,
  75,
  MAX_RATE_LIMIT,
] as const;

/**
 * Slider steps between 5 and 100.
 *
 * Stepping by 5 would make every value in the range reachable but gives a
 * 100px-wide thumb only ~1% of travel, so fine adjustment is impractical.
 * A step of 1 keeps the control usable; the underlying setting is an integer
 * count of dispatches per second, so no precision is lost.
 */
export const RATE_LIMIT_STEP = 1;

/** Converts a rate into the approximate per-hour dispatch ceiling. */
export function rateLimitPerHour(rateLimit: number): number {
  return clampRateLimit(rateLimit) * 3600;
}

export function formatRateLimit(value: number): string {
  return `${clampRateLimit(value)} req/s`;
}
