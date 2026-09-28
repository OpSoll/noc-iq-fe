import { splitMttrMinutes } from '@/lib/mttr';
import { outageMttrMinutes } from '@/lib/mttrHistogram';
import type { Outage } from '@/types/outages';

/**
 * MTTR / MTBF derivation and trend maths for the dashboard metric cards
 * (closes #600).
 *
 * Neither metric is served by `/sla/analytics/dashboard` — that endpoint
 * returns counts and payouts only — so both are derived from the outage
 * records the dashboard already fetches. MTTR reuses {@link outageMttrMinutes},
 * the same accessor the MTTR histogram and PDF export use, so the cards can
 * never disagree with the distribution chart next to them.
 *
 * Where a value genuinely cannot be derived the functions return `null` and the
 * card renders an explicit "no data" state. Nothing is estimated, and no
 * perfect score is implied by an empty sample.
 */

/** Shown wherever a metric cannot be derived. */
export const METRIC_NO_DATA = '—';

/** Direction a metric is moving, already resolved against its "good" polarity. */
export type MetricTrend = 'improving' | 'degrading' | 'flat' | 'unknown';

export interface MetricComparison {
  /** Value for the current period, or null when not derivable. */
  current: number | null;
  /** Value for the previous cycle, or null when not derivable. */
  previous: number | null;
  /** Percentage change against the previous cycle, or null. */
  changePercentage: number | null;
  trend: MetricTrend;
}

const MS_PER_DAY = 86_400_000;

/** Mean time to resolution, in minutes, over the resolved outages supplied. */
export function meanMttrMinutes(outages: Outage[]): number | null {
  const samples: number[] = [];

  for (const outage of outages) {
    const mttr = outageMttrMinutes(outage);
    if (mttr === null || !Number.isFinite(mttr) || mttr < 0) continue;
    samples.push(mttr);
  }

  if (samples.length === 0) return null;

  return samples.reduce((sum, value) => sum + value, 0) / samples.length;
}

/**
 * Mean time between failures, in days, as the mean gap between consecutive
 * failures ordered by detection time.
 *
 * Needs at least two failures: a single failure has no interval to measure, and
 * reporting one would overstate reliability. Null is returned instead.
 */
export function meanTimeBetweenFailuresDays(outages: Outage[]): number | null {
  const detected = outages
    .map((outage) => new Date(outage.detected_at).getTime())
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b);

  if (detected.length < 2) return null;

  let totalGapMs = 0;
  for (let i = 1; i < detected.length; i += 1) {
    totalGapMs += detected[i] - detected[i - 1];
  }

  return totalGapMs / (detected.length - 1) / MS_PER_DAY;
}

/**
 * Signed percentage change of `current` against `previous`.
 *
 * Null when either side is missing, or when the baseline is zero — a change
 * against nothing is not a meaningful percentage, and dividing would produce
 * Infinity.
 */
export function percentageChange(
  current: number | null,
  previous: number | null
): number | null {
  if (current === null || previous === null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return null;

  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Resolves a raw percentage change into a trend, given the metric's polarity.
 * `lowerIsBetter` is true for MTTR (faster resolution is good) and false for
 * MTBF (longer between failures is good).
 */
export function trendFor(
  change: number | null,
  lowerIsBetter: boolean
): MetricTrend {
  if (change === null || !Number.isFinite(change)) return 'unknown';
  if (change === 0) return 'flat';

  const improved = lowerIsBetter ? change < 0 : change > 0;
  return improved ? 'improving' : 'degrading';
}

/** Builds the current/previous comparison for a metric of the given polarity. */
export function compareMetric(
  current: number | null,
  previous: number | null,
  lowerIsBetter: boolean
): MetricComparison {
  const change = percentageChange(current, previous);
  return {
    current,
    previous,
    changePercentage: change,
    trend: trendFor(change, lowerIsBetter),
  };
}

/**
 * Formats a duration given in minutes as whole hours and minutes, e.g.
 * `2h 15m`, `45m`, `3h`. Reuses {@link splitMttrMinutes} so MTTR reads the
 * same way it does in the resolution modal.
 */
export function formatMttrDuration(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes) || minutes < 0) {
    return METRIC_NO_DATA;
  }

  const { hours, minutes: remainder } = splitMttrMinutes(Math.round(minutes));

  if (hours === 0) return `${remainder}m`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

/** Formats an MTBF value expressed in days, e.g. `3.4 days`, `1.0 day`. */
export function formatMtbfDuration(days: number | null): string {
  if (days === null || !Number.isFinite(days) || days < 0) {
    return METRIC_NO_DATA;
  }

  const rounded = Number(days.toFixed(1));
  return `${rounded.toFixed(1)} ${rounded === 1 ? 'day' : 'days'}`;
}

/**
 * Renders the comparison half of a metric card: `+12.0% vs previous cycle`,
 * or a plain sentence when there is no baseline to compare with.
 */
export function describeComparison(comparison: MetricComparison): string {
  if (comparison.trend === 'unknown' || comparison.changePercentage === null) {
    return 'No prior cycle to compare';
  }

  const sign = comparison.changePercentage > 0 ? '+' : '';
  return `${sign}${comparison.changePercentage.toFixed(1)}% vs previous cycle`;
}
