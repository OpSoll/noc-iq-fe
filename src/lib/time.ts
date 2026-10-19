/**
 * Centralized time formatting helpers (#993).
 *
 * Relative-time formatting was previously done ad hoc inside components, which
 * made boundary behaviour (a value just over a minute, exactly a day, a future
 * timestamp, a missing backend field) impossible to verify and easy to regress.
 * This module is the single source of truth and is fully covered by
 * `src/lib/time.test.ts`:
 *
 *   - `formatRelativeTime` — "just now", "5 minutes ago", "in 3 days"
 *   - `formatAbsoluteDate` / `formatAbsoluteDateTime` — locale-aware dates
 *   - `formatTimestamp` — the default "date + time" rendering
 *
 * All helpers accept `null`/`undefined`/invalid input and return
 * `INVALID_TIME_PLACEHOLDER` instead of throwing, so a missing backend field can
 * never blank out a row.
 */

/** Rendered when a value is missing or cannot be parsed as a date. */
export const INVALID_TIME_PLACEHOLDER = '—';

const SECOND = 1;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/** Below this many seconds a timestamp reads as "just now". */
const JUST_NOW_THRESHOLD_SECONDS = 45;

export interface RelativeTimeOptions {
  /** Value to render for missing/invalid input (default `INVALID_TIME_PLACEHOLDER`). */
  fallback?: string;
  /** BCP-47 locale passed through to `Intl.RelativeTimeFormat`. */
  locale?: string;
  /** Injected "now" for deterministic tests. */
  now?: Date | number;
}

/**
 * Parse anything date-ish into a `Date`, or `null` when it is missing/invalid.
 * Numbers are treated as epoch milliseconds.
 */
export function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date =
    value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Human-readable relative time, e.g. "just now", "5 minutes ago",
 * "in 3 days". Future timestamps are phrased with "in ...", and the unit is the
 * largest one the delta fills so a value never reads "90 minutes ago".
 */
export function formatRelativeTime(
  value: unknown,
  options: RelativeTimeOptions = {}
): string {
  const { fallback = INVALID_TIME_PLACEHOLDER, locale, now } = options;
  const date = parseDate(value);
  if (!date) return fallback;

  const nowMs = now === undefined ? Date.now() : new Date(now).getTime();
  const diffSeconds = Math.round((date.getTime() - nowMs) / 1000);

  // `numeric: 'always'` keeps boundary output predictable ("1 day ago" rather
  // than the locale's "yesterday"/"last week"), which is what callers and the
  // boundary tests rely on; pluralization and the future/past sign are still
  // handled by the formatter.
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'always' });

  if (Math.abs(diffSeconds) < JUST_NOW_THRESHOLD_SECONDS) {
    return 'just now';
  }

  const absolute = Math.abs(diffSeconds);
  const sign = diffSeconds < 0 ? -1 : 1;

  let unit: Intl.RelativeTimeFormatUnit;
  let divisor: number;
  if (absolute < MINUTE) {
    unit = 'second';
    divisor = SECOND;
  } else if (absolute < HOUR) {
    unit = 'minute';
    divisor = MINUTE;
  } else if (absolute < DAY) {
    unit = 'hour';
    divisor = HOUR;
  } else if (absolute < WEEK) {
    unit = 'day';
    divisor = DAY;
  } else if (absolute < MONTH) {
    unit = 'week';
    divisor = WEEK;
  } else if (absolute < YEAR) {
    unit = 'month';
    divisor = MONTH;
  } else {
    unit = 'year';
    divisor = YEAR;
  }

  return formatter.format(sign * Math.round(absolute / divisor), unit);
}

/** Locale-aware date, e.g. "19 Oct 2026". Missing/invalid input renders the placeholder. */
export function formatAbsoluteDate(
  value: unknown,
  locale?: string,
  fallback: string = INVALID_TIME_PLACEHOLDER
): string {
  const date = parseDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** Locale-aware date and time, e.g. "19 Oct 2026, 14:05". */
export function formatAbsoluteDateTime(
  value: unknown,
  locale?: string,
  fallback: string = INVALID_TIME_PLACEHOLDER
): string {
  const date = parseDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Default timestamp rendering (date + time); the placeholder for invalid input. */
export function formatTimestamp(
  value: unknown,
  locale?: string,
  fallback: string = INVALID_TIME_PLACEHOLDER
): string {
  return formatAbsoluteDateTime(value, locale, fallback);
}

/** Short timezone abbreviation for a date, e.g. "UTC". Placeholder when invalid. */
export function getTimeZoneAbbreviation(
  value: unknown,
  locale?: string,
  fallback: string = INVALID_TIME_PLACEHOLDER
): string {
  const date = parseDate(value);
  if (!date) return fallback;
  const parts = new Intl.DateTimeFormat(locale, {
    timeZoneName: 'short',
  }).formatToParts(date);
  return (
    parts.find((part) => part.type === 'timeZoneName')?.value ?? fallback
  );
}
