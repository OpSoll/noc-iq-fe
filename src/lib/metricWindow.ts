import type { Outage } from '@/types/outages';

/**
 * Shared rolling-window maths for the dashboard metric widgets.
 *
 * The dashboard's date filters are optional, but the availability widget
 * (closes #599) and the current-vs-previous-cycle comparison on the MTTR/MTBF
 * cards (closes #600) both need a bounded period to measure against.
 * Centralising the resolution here means the two widgets — and the labels they
 * render — can never disagree about which period is being reported.
 */

/** History assumed when the dashboard has no date filter applied. */
export const DEFAULT_WINDOW_DAYS = 30;

const DAY_MS = 86_400_000;
const ISO_DAY_LENGTH = 10;

export interface MetricWindow {
  /** Inclusive start of the measured period. */
  from: Date;
  /** Exclusive end of the measured period. */
  to: Date;
}

/** Parses a date filter into a Date, or null when absent/unparseable. */
function parseDate(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Moves a parsed `dateTo` to the start of the following day, so windows are
 * half-open `[from, to)`. A single-day filter therefore describes a full day
 * rather than a zero-length window, and consecutive windows tile exactly — the
 * previous-cycle baseline can neither gap by a millisecond nor overlap.
 */
function dayAfter(date: Date): Date {
  return new Date(date.getTime() + DAY_MS);
}

/**
 * Resolves the period a metric should be measured over.
 *
 * - both bounds set: that exact span, with `dateTo` widened to end-of-day
 * - only `dateFrom`: from that day up to `now`
 * - only `dateTo`: the {@link DEFAULT_WINDOW_DAYS} days ending on `dateTo`
 * - neither: the {@link DEFAULT_WINDOW_DAYS} days ending at `now`
 *
 * `now` is injectable so the result is deterministic under test.
 */
export function resolveMetricWindow(
  dateFrom?: string,
  dateTo?: string,
  now: Date = new Date()
): MetricWindow {
  const from = parseDate(dateFrom);
  const to = parseDate(dateTo);

  if (from && to) {
    return { from, to: dayAfter(to) };
  }

  if (from) {
    return { from, to: now };
  }

  if (to) {
    const end = dayAfter(to);
    return {
      from: new Date(end.getTime() - DEFAULT_WINDOW_DAYS * DAY_MS),
      to: end,
    };
  }

  return {
    from: new Date(now.getTime() - DEFAULT_WINDOW_DAYS * DAY_MS),
    to: now,
  };
}

/**
 * The equally long period immediately before `window`, used as the "previous
 * billing cycle" baseline for the MTTR/MTBF delta indicators (#600).
 */
export function resolvePreviousWindow(window: MetricWindow): MetricWindow {
  const from = window.from.getTime();
  const span = window.to.getTime() - from;
  return { from: new Date(from - span), to: new Date(from) };
}

/** True when `value` (an ISO timestamp) falls inside the window's half-open span. */
export function isWithinWindow(
  value: string | undefined,
  window: MetricWindow
): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  return time >= window.from.getTime() && time < window.to.getTime();
}

/**
 * Keeps only the outages detected inside the window. Detection time is the
 * right anchor for both metrics: a failure counts once, when it starts.
 */
export function filterOutagesByDetectedAt(
  outages: Outage[],
  window: MetricWindow
): Outage[] {
  return outages.filter((outage) => isWithinWindow(outage.detected_at, window));
}

/**
 * `YYYY-MM-DD → YYYY-MM-DD` label for the resolved period. `to` is exclusive,
 * so the label names the last day actually included rather than the boundary.
 */
export function formatWindowLabel(window: MetricWindow): string {
  const lastIncluded = new Date(window.to.getTime() - 1);
  return `${toIsoDay(window.from)} → ${toIsoDay(lastIncluded)}`;
}

/** ISO calendar day of a timestamp, tolerant of an invalid Date. */
export function toIsoDay(date: Date): string {
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toISOString().slice(0, ISO_DAY_LENGTH);
}
