import type { WebhookDelivery } from '@/types/webhook';

/**
 * Delivery health classification for a webhook endpoint.
 *
 * An endpoint is disabled automatically once its recent success rate collapses
 * — repeatedly POSTing to a receiver that is down wastes dispatcher capacity
 * and buries genuinely new failures. Operators need to see that state at a
 * glance, and need the success rate behind it, because a "Degraded" endpoint
 * at 78% looks very different from one at 96%.
 *
 * Closes #667 — webhook endpoint health status pill indicator.
 */

/** How many recent dispatches the health verdict is based on. */
export const HEALTH_SAMPLE_SIZE = 100;

export type WebhookHealthStatus = 'healthy' | 'degraded' | 'disabled' | 'unknown';

export interface WebhookHealth {
  status: WebhookHealthStatus;
  /** Success rate as a percentage (0-100) over the sampled dispatches. */
  successRate: number;
  /** Number of dispatches actually considered, capped at the sample size. */
  sampleSize: number;
  /** Number of successful dispatches in the sample. */
  successCount: number;
  /** Number of failed dispatches in the sample. */
  failureCount: number;
  /** Whether a re-enable confirmation is appropriate. */
  canReenable: boolean;
}

/** Success rate at or above this is considered healthy. */
export const HEALTHY_THRESHOLD = 95;
/** Success rate below this is considered degraded. */
export const DEGRADED_THRESHOLD = 80;

function isSuccess(delivery: WebhookDelivery): boolean {
  if (delivery.status === 'success') return true;
  const code = delivery.response_code;
  return typeof code === 'number' && code >= 200 && code < 300;
}

/**
 * Classifies an endpoint from its most recent dispatches.
 *
 * Only the last `HEALTH_SAMPLE_SIZE` dispatches are considered so a healthy
 * endpoint does not get permanently marked degraded by an old incident, and
 * so a fresh endpoint is not judged on a single unlucky request.
 *
 * An explicitly inactive endpoint is reported as `disabled` regardless of its
 * history — the operator turned it off, and the rate is still reported as
 * supporting context.
 */
export function calculateWebhookHealth(
  deliveries: WebhookDelivery[],
  options: { isActive?: boolean; sampleSize?: number } = {}
): WebhookHealth {
  const { isActive = true, sampleSize = HEALTH_SAMPLE_SIZE } = options;
  const limit = Math.max(1, Math.floor(sampleSize));

  // Newest first in the API response; normalise so the sample is deterministic.
  const sample = [...deliveries].slice(0, limit);
  const successCount = sample.filter(isSuccess).length;
  const failureCount = sample.length - successCount;
  const successRate =
    sample.length === 0 ? 0 : (successCount / sample.length) * 100;

  let status: WebhookHealthStatus;
  if (!isActive) {
    status = 'disabled';
  } else if (sample.length === 0) {
    status = 'unknown';
  } else if (successRate >= HEALTHY_THRESHOLD) {
    status = 'healthy';
  } else if (successRate >= DEGRADED_THRESHOLD) {
    status = 'degraded';
  } else {
    status = 'degraded';
  }

  return {
    status,
    successRate: Math.round(successRate * 10) / 10,
    sampleSize: sample.length,
    successCount,
    failureCount,
    canReenable: !isActive,
  };
}

export const HEALTH_LABELS: Record<WebhookHealthStatus, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  disabled: 'Disabled',
  unknown: 'No data',
};

export const HEALTH_DESCRIPTIONS: Record<WebhookHealthStatus, string> = {
  healthy: 'Delivering normally',
  degraded: 'Some deliveries are failing',
  disabled: 'Automatic delivery is turned off',
  unknown: 'Not enough delivery history yet',
};

/** Tailwind classes per status: green / yellow / red, as the issue specifies. */
export const HEALTH_CLASSES: Record<WebhookHealthStatus, string> = {
  healthy: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  degraded: 'border-amber-200 bg-amber-50 text-amber-700',
  disabled: 'border-red-200 bg-red-50 text-red-700',
  unknown: 'border-slate-200 bg-slate-50 text-slate-500',
};

export const HEALTH_DOT_CLASSES: Record<WebhookHealthStatus, string> = {
  healthy: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  disabled: 'bg-red-500',
  unknown: 'bg-slate-400',
};

/** Text for the pill's hover tooltip / accessible description. */
export function healthTooltip(health: WebhookHealth): string {
  if (health.status === 'unknown') {
    return 'No deliveries recorded yet';
  }
  return `${health.successRate}% success over the last ${health.sampleSize} dispatch${
    health.sampleSize === 1 ? '' : 'es'
  } (${health.successCount} succeeded, ${health.failureCount} failed)`;
}
