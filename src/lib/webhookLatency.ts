import type { WebhookDelivery } from '@/types/webhook';

/**
 * Daily latency aggregation for the webhook delivery chart.
 *
 * Plotting raw dispatches is unreadable — an endpoint on a busy day has
 * thousands of points. Averaging per calendar day gives a trend line, and the
 * p95 is carried alongside because an average hides exactly the thing an
 * operator needs to see: a receiver that is fast most of the time and
 * pathological occasionally.
 *
 * Closes #673 — delivery latency performance line chart.
 */

/** Average daily delivery latency above this is flagged as a spike. */
export const LATENCY_SPIKE_THRESHOLD_MS = 1000;

/** How many days the chart shows. */
export const LATENCY_WINDOW_DAYS = 7;

export interface LatencySample {
  /** `YYYY-MM-DD` in UTC. */
  date: string;
  /** Mean delivery latency in milliseconds. */
  averageMs: number;
  /** 95th percentile latency in milliseconds. */
  p95Ms: number;
  /** Highest single delivery latency in milliseconds. */
  maxMs: number;
  /** Number of dispatches that day. */
  count: number;
  /** True when `averageMs` exceeds the spike threshold. */
  isSpike: boolean;
}

function getLatencyMs(delivery: WebhookDelivery): number | null {
  const raw = (delivery as WebhookDelivery & { latency_ms?: unknown }).latency_ms;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, raw);
  if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) {
    return Math.max(0, Number(raw));
  }
  return null;
}

/** `YYYY-MM-DD` in UTC for an ISO timestamp. */
export function toUtcDateKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

/** Nearest-rank percentile of a pre-sorted ascending array. */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sorted.length);
  const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[index];
}

/**
 * Buckets dispatches into one sample per UTC day.
 *
 * Days with no dispatches are omitted rather than filled with zero, so a gap
 * in traffic is not misread as an instant-improvement to 0 ms.
 */
export function aggregateLatencyByDay(
  deliveries: WebhookDelivery[],
  options: { thresholdMs?: number } = {}
): LatencySample[] {
  const threshold = options.thresholdMs ?? LATENCY_SPIKE_THRESHOLD_MS;
  const buckets = new Map<string, number[]>();

  for (const delivery of deliveries) {
    const key = toUtcDateKey(delivery.created_at);
    if (!key) continue;
    const latency = getLatencyMs(delivery);
    if (latency === null) continue;
    const existing = buckets.get(key);
    if (existing) existing.push(latency);
    else buckets.set(key, [latency]);
  }

  return Array.from(buckets.entries())
    .map(([date, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      const total = sorted.reduce((sum, v) => sum + v, 0);
      const averageMs = total / sorted.length;
      return {
        date,
        averageMs: Math.round(averageMs),
        p95Ms: Math.round(percentile(sorted, 95)),
        maxMs: Math.round(sorted[sorted.length - 1]),
        count: sorted.length,
        isSpike: averageMs > threshold,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Keeps only the most recent `days` samples, ordered oldest to newest. */
export function toLatencyWindow(
  samples: LatencySample[],
  days: number = LATENCY_WINDOW_DAYS
): LatencySample[] {
  return samples.slice(-Math.max(1, Math.floor(days)));
}

/**
 * Builds the plot geometry for the chart.
 *
 * A `maxMs` of 0 would make every division by zero, so the axis is floored at
 * 1 ms. Spikes are also stretched beyond the highest point so the line never
 * sits on the chart's top edge, where it would be clipped.
 */
export interface LatencyPlot {
  points: Array<{ x: number; y: number; sample: LatencySample }>;
  maxMs: number;
  width: number;
  height: number;
  thresholdY: number;
}

export function buildLatencyPlot(
  samples: LatencySample[],
  options: { width?: number; height?: number; padding?: number; thresholdMs?: number } = {}
): LatencyPlot {
  const width = options.width ?? 560;
  const height = options.height ?? 180;
  const padding = options.padding ?? 16;
  const thresholdMs = options.thresholdMs ?? LATENCY_SPIKE_THRESHOLD_MS;

  const peak = samples.reduce((max, s) => Math.max(max, s.averageMs), 0);
  const maxMs = Math.max(peak * 1.1, thresholdMs * 1.1, 1);
  const plotHeight = height - padding * 2;
  const plotWidth = width - padding * 2;
  const denominator = Math.max(1, samples.length - 1);

  const points = samples.map((sample, index) => ({
    x: padding + (index / denominator) * plotWidth,
    y: padding + plotHeight - (sample.averageMs / maxMs) * plotHeight,
    sample,
  }));

  return {
    points,
    maxMs: Math.round(maxMs),
    width,
    height,
    thresholdY: padding + plotHeight - (thresholdMs / maxMs) * plotHeight,
  };
}

/** Builds an SVG polyline `points` attribute from the plot. */
export function toPolylinePoints(plot: LatencyPlot): string {
  return plot.points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

/** Human summary of a series, for the chart's caption and screen readers. */
export function summarizeLatency(samples: LatencySample[]): string {
  if (samples.length === 0) return 'No latency data recorded.';

  const spikeDays = samples.filter((s) => s.isSpike).length;
  const worst = samples.reduce((max, s) => (s.averageMs > max.averageMs ? s : max));
  const total = samples.reduce((sum, s) => sum + s.count, 0);

  const parts = [
    `${samples.length} day${samples.length === 1 ? '' : 's'} of data across ${total} dispatch${
      total === 1 ? '' : 'es'
    }.`,
    `Peak daily average ${worst.averageMs}ms on ${worst.date}.`,
  ];
  if (spikeDays > 0) {
    parts.push(`${spikeDays} day${spikeDays === 1 ? '' : 's'} exceeded the 1000ms threshold.`);
  }
  return parts.join(' ');
}
