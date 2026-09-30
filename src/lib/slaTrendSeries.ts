import type { Outage } from '@/types/outages';

/**
 * Daily SLA compliance series for the history chart (closes #603).
 *
 * Each bucket is a UTC calendar day. A day's downtime is the union of the
 * outage intervals that fall inside it — merged rather than summed, so two
 * concurrent outages cannot report more downtime than the day contains — and
 * availability is derived from that union. An outage spanning midnight is
 * therefore attributed to the days it actually covered rather than wholly to
 * the day it started.
 *
 * Window resolution and interval merging are implemented here rather than
 * reusing `@/lib/slaAvailability` and `@/lib/metricWindow`, because those
 * modules arrive with a separate change and this one has to stand alone
 * against `main`. If both land, this module should be unified onto them.
 */

/** Selectable chart timeframes, in days. */
export const TREND_WINDOW_DAYS = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
} as const;

export type TrendWindowKey = keyof typeof TREND_WINDOW_DAYS;

export const TREND_WINDOW_KEYS = Object.keys(
  TREND_WINDOW_DAYS
) as TrendWindowKey[];

/** History assumed when the dashboard has no date filter applied. */
export const DEFAULT_TREND_WINDOW_DAYS = 30;

const DAY_MS = 86_400_000;

export interface TrendWindow {
  /** Inclusive start of the measured period. */
  from: Date;
  /** Exclusive end of the measured period. */
  to: Date;
}

export interface SlaTrendDatum {
  /** UTC calendar day, `YYYY-MM-DD`. */
  date: string;
  /** Uptime percentage for the day, 0-100. */
  availabilityPercentage: number;
  /** Outages that overlapped the day. */
  outageCount: number;
  /** Downtime inside the day, in minutes, after merging overlaps. */
  downtimeMinutes: number;
}

/** Parses a date filter into a Date, or null when absent/unparseable. */
function parseDate(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Resolves the measured period.
 *
 * Both bounds: that span, with `dateTo` widened to the following midnight so a
 * single-day filter describes a whole day and consecutive windows tile exactly.
 * Only `dateFrom`: from that day up to `now`. Otherwise: the trailing
 * {@link DEFAULT_TREND_WINDOW_DAYS} days ending at `dateTo` or `now`.
 */
export function resolveTrendWindow(
  dateFrom?: string,
  dateTo?: string,
  now: Date = new Date()
): TrendWindow {
  const from = parseDate(dateFrom);
  const to = parseDate(dateTo);

  if (from && to) {
    return { from, to: new Date(to.getTime() + DAY_MS) };
  }
  if (from) {
    return { from, to: now };
  }

  const end = to ? new Date(to.getTime() + DAY_MS) : now;
  return {
    from: new Date(end.getTime() - DEFAULT_TREND_WINDOW_DAYS * DAY_MS),
    to: end,
  };
}

/** Midnight UTC of the day containing `date`. */
function utcDayStart(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

interface Interval {
  start: number;
  end: number;
}

/**
 * Merged downtime for the outages overlapping `[from, to)`, in minutes, along
 * with how many outages contributed.
 */
function measureDowntime(
  outages: Outage[],
  from: number,
  to: number
): { downtimeMinutes: number; outageCount: number } {
  const intervals: Interval[] = [];

  for (const outage of outages) {
    const detected = new Date(outage.detected_at).getTime();
    if (Number.isNaN(detected)) continue;

    // An unresolved outage is downtime that is still accruing, so it runs to
    // the end of the day instead of being discarded.
    const end = outage.resolved_at
      ? new Date(outage.resolved_at).getTime()
      : to;
    if (Number.isNaN(end) || end < detected) continue;

    const start = Math.max(detected, from);
    const clipped = Math.min(end, to);
    if (clipped <= start) continue;

    intervals.push({ start, end: clipped });
  }

  if (intervals.length === 0) return { downtimeMinutes: 0, outageCount: 0 };

  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  let mergedMinutes = 0;
  let cursorStart = sorted[0].start;
  let cursorEnd = sorted[0].end;

  for (const interval of sorted.slice(1)) {
    if (interval.start <= cursorEnd) {
      cursorEnd = Math.max(cursorEnd, interval.end);
    } else {
      mergedMinutes += cursorEnd - cursorStart;
      cursorStart = interval.start;
      cursorEnd = interval.end;
    }
  }
  mergedMinutes += cursorEnd - cursorStart;

  return {
    downtimeMinutes: mergedMinutes / 60_000,
    outageCount: intervals.length,
  };
}

/**
 * Buckets the window into UTC days and measures each one.
 *
 * The final bucket stops at the window's end rather than running to midnight,
 * so a window ending mid-day reports that day's partial figures instead of
 * counting time outside the requested range.
 */
export function buildSlaTrendSeries(
  outages: Outage[],
  window: TrendWindow
): SlaTrendDatum[] {
  const windowEnd = window.to.getTime();
  const windowStart = window.from.getTime();
  if (!(windowEnd > windowStart)) return [];

  const series: SlaTrendDatum[] = [];

  for (
    let dayStart = utcDayStart(window.from);
    dayStart < windowEnd;
    dayStart += DAY_MS
  ) {
    const dayFrom = Math.max(dayStart, windowStart);
    const dayTo = Math.min(dayStart + DAY_MS, windowEnd);

    const { downtimeMinutes, outageCount } = measureDowntime(
      outages,
      dayFrom,
      dayTo
    );

    const dayMinutes = (dayTo - dayFrom) / 60_000;
    const availability =
      dayMinutes > 0
        ? Math.max(
            0,
            Math.min(100, ((dayMinutes - downtimeMinutes) / dayMinutes) * 100)
          )
        : 100;

    series.push({
      date: new Date(dayStart).toISOString().slice(0, 10),
      availabilityPercentage: availability,
      outageCount,
      downtimeMinutes,
    });
  }

  return series;
}

/** Trims a series to the trailing `windowKey` days. */
export function sliceTrendSeries(
  series: SlaTrendDatum[],
  windowKey: TrendWindowKey
): SlaTrendDatum[] {
  const days = TREND_WINDOW_DAYS[windowKey];
  return series.slice(Math.max(0, series.length - days));
}

export interface TrendScale {
  /** Lower bound of the y-axis, always at or below the target line. */
  min: number;
  /** Upper bound, always 100 (a perfect day). */
  max: number;
}

/**
 * Y-axis domain for the chart.
 *
 * Availability sits in a narrow band near 100%, so a fixed 0-100 axis would
 * flatten every real movement into a straight line. The axis starts just below
 * the worst observed day — and never above the target, so the threshold line is
 * always visible.
 */
export function computeTrendScale(
  series: SlaTrendDatum[],
  targetPercentage: number,
  paddingPercentage = 0.5
): TrendScale {
  const worst = series.reduce(
    (lowest, point) =>
      Number.isFinite(point.availabilityPercentage)
        ? Math.min(lowest, point.availabilityPercentage)
        : lowest,
    targetPercentage
  );

  return {
    min: Math.max(0, Math.min(worst, targetPercentage) - paddingPercentage),
    max: 100,
  };
}

/** Maps a value in the scale onto an SVG y coordinate. */
export function scaleY(
  value: number,
  scale: TrendScale,
  height: number
): number {
  const span = scale.max - scale.min;
  if (!(span > 0)) return height;
  const ratio = (value - scale.min) / span;
  return height - Math.min(1, Math.max(0, ratio)) * height;
}

/** Maps a series index onto an SVG x coordinate across `width`. */
export function scaleX(index: number, count: number, width: number): number {
  if (count <= 1) return width / 2;
  return (index / (count - 1)) * width;
}

/** Filled area path tracing availability from its points down to the baseline. */
export function trendAreaPath(
  series: SlaTrendDatum[],
  scale: TrendScale,
  width: number,
  height: number
): string {
  if (series.length === 0) return '';

  const points = series.map((point, index) => ({
    x: scaleX(index, series.length, width),
    y: scaleY(point.availabilityPercentage, scale, height),
  }));

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  const first = points[0];
  const last = points[points.length - 1];

  return `${line} L ${last.x} ${height} L ${first.x} ${height} Z`;
}
