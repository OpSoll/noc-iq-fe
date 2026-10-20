/**
 * Centralized time formatting helpers (#973).
 *
 * Previously every component did its own `new Date(x).toLocaleString()` or an
 * ad-hoc relative-time calculation, so the same timestamp rendered differently
 * (and crashed on `null`/invalid values) depending on where it appeared. These
 * helpers are the single source of truth:
 *
 *   - `formatRelativeTime` — "3 minutes ago", "in 2 hours"
 *   - `formatAbsoluteDate` / `formatAbsoluteDateTime` — locale-aware dates
 *   - `formatTimestamp` — the default "date + time" rendering
 *
 * All helpers accept `null`/`undefined`/invalid input and return
 * `INVALID_TIME_PLACEHOLDER` instead of throwing, so a missing backend field can
 * never blank out a row.
 */

/** Rendered when a value is missing or cannot be parsed as a date. */
export const INVALID_TIME_PLACEHOLDER = '—';

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

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
  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Human-readable relative time, e.g. "just now", "5 minutes ago",
 * "in 3 days". Future timestamps are phrased with "in ...".
 */
export function formatRelativeTime(
  value: unknown,
  options: RelativeTimeOptions = {}
): string {
  const { fallback = INVALID_TIME_PLACEHOLDER, now } = options;
  const date = parseDate(value);
  if (!date) return fallback;

  const nowMs = now === undefined ? Date.now() : new Date(now).getTime();
  const diffSeconds = Math.round((date.getTime() - nowMs) / 1000);
  const abs = Math.abs(diffSeconds);

  if (abs < 45) return 'just now';

  const { amount, unit } = describeDuration(abs);

  // `Intl.RelativeTimeFormat` produces "5 minutes ago" / "in 3 days" and
  // handles pluralization and the future/past sign for us.
  const formatter = new Intl.RelativeTimeFormat(options.locale, {
    numeric: 'auto',
  });
  return formatter.format(diffSeconds < 0 ? -amount : amount, unit);
}

function describeDuration(seconds: number): {
  amount: number;
  unit: Intl.RelativeTimeFormatUnit;
} {
  if (seconds < MINUTE) return { amount: Math.round(seconds), unit: 'second' };
  if (seconds < HOUR) return { amount: Math.round(seconds / MINUTE), unit: 'minute' };
  if (seconds < DAY) return { amount: Math.round(seconds / HOUR), unit: 'hour' };
  if (seconds < WEEK) return { amount: Math.round(seconds / DAY), unit: 'day' };
  if (seconds < MONTH) return { amount: Math.round(seconds / WEEK), unit: 'week' };
  if (seconds < YEAR) return { amount: Math.round(seconds / MONTH), unit: 'month' };
  return { amount: Math.round(seconds / YEAR), unit: 'year' };
}

export interface AbsoluteTimeOptions {
  fallback?: string;
  locale?: string;
  timeZone?: string;
}

/** Locale-aware date only, e.g. "10/19/2026". */
export function formatAbsoluteDate(
  value: unknown,
  options: AbsoluteTimeOptions = {}
): string {
  const { fallback = INVALID_TIME_PLACEHOLDER, locale, timeZone } = options;
  const date = parseDate(value);
  if (!date) return fallback;
  return date.toLocaleDateString(locale, { timeZone });
}

/** Locale-aware date + time, e.g. "10/19/2026, 8:15:00 PM". */
export function formatAbsoluteDateTime(
  value: unknown,
  options: AbsoluteTimeOptions = {}
): string {
  const { fallback = INVALID_TIME_PLACEHOLDER, locale, timeZone } = options;
  const date = parseDate(value);
  if (!date) return fallback;
  return date.toLocaleString(locale, { timeZone });
}

/**
 * Default timestamp rendering used across tables and detail views: absolute
 * date + time, with an optional short timezone label.
 */
export function formatTimestamp(
  value: unknown,
  options: AbsoluteTimeOptions = {}
): string {
  return formatAbsoluteDateTime(value, options);
}

/**
 * Short timezone abbreviation for a timestamp (e.g. "UTC", "GMT+1"), or `null`
 * when the input is invalid. Uses `Intl` so it reflects the runtime zone.
 */
export function getTimeZoneAbbreviation(
  value: unknown,
  locale?: string
): string | null {
  const date = parseDate(value);
  if (!date) return null;
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZoneName: 'short',
    }).formatToParts(date);
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? null;
  } catch {
    return null;
  }
}
