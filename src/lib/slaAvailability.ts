import type { Outage } from '@/types/outages';

import type { MetricWindow } from '@/lib/metricWindow';

/**
 * Availability maths for the dashboard's live SLA availability widget
 * (closes #599).
 *
 * Availability is *derived* from outage downtime rather than read from a
 * dedicated field: `/sla/analytics/dashboard` reports violations and payouts
 * but exposes no availability or uptime number, and outage downtime is already
 * the authoritative input the backend scores SLA compliance from. Deriving it
 * here keeps the widget honest — when there is nothing to measure it reports
 * "no data" instead of inventing a perfect 100.000%.
 */

/** Decimal places the widget renders availability with (issue #599). */
export const AVAILABILITY_PRECISION = 3;

/** Shown whenever availability cannot be measured. */
export const AVAILABILITY_NO_DATA = '—';

export interface AvailabilityResult {
  /** Uptime percentage 0-100, or null when the window covers no measurable time. */
  percentage: number | null;
  /** Downtime inside the window, in minutes, after merging overlapping outages. */
  downtimeMinutes: number;
  /** Length of the measured window, in minutes. */
  windowMinutes: number;
  /** Number of outages that contributed downtime. */
  affectedOutageCount: number;
}

interface Interval {
  start: number;
  end: number;
}

const MS_PER_MINUTE = 60_000;

/**
 * Clips a single outage to the window, or null when it contributes no downtime
 * inside it.
 *
 * An unresolved outage is downtime that is still accruing, so it runs to the
 * end of the window rather than being discarded. Outages that resolve before
 * they are detected are treated as unmeasurable rather than producing negative
 * downtime.
 */
function clipOutageToWindow(
  outage: Outage,
  window: MetricWindow
): Interval | null {
  const detected = new Date(outage.detected_at).getTime();
  if (Number.isNaN(detected)) return null;

  const end = outage.resolved_at
    ? new Date(outage.resolved_at).getTime()
    : window.to.getTime();
  if (Number.isNaN(end) || end < detected) return null;

  const start = Math.max(detected, window.from.getTime());
  const clipped = Math.min(end, window.to.getTime());
  if (clipped <= start) return null;

  return { start, end: clipped };
}

/**
 * Merges overlapping intervals so concurrent outages (say a site-wide outage
 * overlapping a service-level one) are counted once. Without this, downtime
 * could exceed the length of the window and availability would go negative.
 */
function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [{ ...sorted[0] }];

  for (const interval of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }

  return merged;
}

/**
 * Availability across `window`, computed as
 * `(window - merged downtime) / window`.
 *
 * Returns `percentage: null` for an empty or inverted window — there is no
 * honest percentage to report for a period with no duration.
 */
export function computeAvailability(
  outages: Outage[],
  window: MetricWindow
): AvailabilityResult {
  const totalMs = window.to.getTime() - window.from.getTime();

  if (!Number.isFinite(totalMs) || totalMs <= 0) {
    return {
      percentage: null,
      downtimeMinutes: 0,
      windowMinutes: 0,
      affectedOutageCount: 0,
    };
  }

  const intervals: Interval[] = [];
  let affectedOutageCount = 0;

  for (const outage of outages) {
    // Deliberately *not* filtered by detection time: an outage that began
    // before the window still caused downtime inside it, so it is clipped
    // rather than discarded. Outages that fall entirely outside the window are
    // rejected by the clip itself.
    const interval = clipOutageToWindow(outage, window);
    if (!interval) continue;

    intervals.push(interval);
    affectedOutageCount += 1;
  }

  const downtimeMs = mergeIntervals(intervals).reduce(
    (sum, interval) => sum + (interval.end - interval.start),
    0
  );
  const uptimeMs = Math.max(0, totalMs - downtimeMs);

  return {
    percentage: (uptimeMs / totalMs) * 100,
    downtimeMinutes: downtimeMs / MS_PER_MINUTE,
    windowMinutes: totalMs / MS_PER_MINUTE,
    affectedOutageCount,
  };
}

/**
 * Renders availability at the widget's fixed precision, e.g. `99.982%`.
 * A null or non-finite value renders {@link AVAILABILITY_NO_DATA}.
 */
export function formatAvailability(percentage: number | null): string {
  if (percentage === null || !Number.isFinite(percentage)) {
    return AVAILABILITY_NO_DATA;
  }
  return `${percentage.toFixed(AVAILABILITY_PRECISION)}%`;
}
