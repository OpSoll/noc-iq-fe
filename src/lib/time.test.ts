import { describe, expect, it } from 'vitest';

import {
  formatAbsoluteDate,
  formatAbsoluteDateTime,
  formatRelativeTime,
  formatTimestamp,
  getTimeZoneAbbreviation,
  INVALID_TIME_PLACEHOLDER,
  parseDate,
} from './time';

/**
 * #993 — tests for the relative time formatter.
 *
 * Boundary values (seconds, minutes, hours, days), invalid inputs and future
 * dates. `now` is injected everywhere so the assertions never depend on the
 * wall clock, and a fixed locale/zone keeps them deterministic.
 */

const NOW = new Date('2026-10-19T12:00:00.000Z');

/** A timestamp `seconds` before NOW (negative = in the future). */
function beforeNow(seconds: number): Date {
  return new Date(NOW.getTime() - seconds * 1000);
}

const opts = { now: NOW, locale: 'en-US' } as const;

describe('formatRelativeTime — seconds (#993)', () => {
  it('renders "just now" for the current instant', () => {
    expect(formatRelativeTime(beforeNow(0), opts)).toBe('just now');
  });

  it('renders "just now" for a few seconds ago', () => {
    expect(formatRelativeTime(beforeNow(10), opts)).toBe('just now');
    expect(formatRelativeTime(beforeNow(44), opts)).toBe('just now');
  });

  it('switches to seconds once past the just-now threshold', () => {
    expect(formatRelativeTime(beforeNow(45), opts)).toBe('45 seconds ago');
  });
});

describe('formatRelativeTime — minutes (#993)', () => {
  it('renders exactly one minute ago at the 60s boundary', () => {
    expect(formatRelativeTime(beforeNow(60), opts)).toBe('1 minute ago');
  });

  it('renders plural minutes', () => {
    expect(formatRelativeTime(beforeNow(5 * 60), opts)).toBe('5 minutes ago');
  });

  it('stays in minutes just under an hour', () => {
    expect(formatRelativeTime(beforeNow(59 * 60), opts)).toBe('59 minutes ago');
  });
});

describe('formatRelativeTime — hours (#993)', () => {
  it('switches to hours at the 60-minute boundary', () => {
    expect(formatRelativeTime(beforeNow(60 * 60), opts)).toBe('1 hour ago');
  });

  it('renders plural hours', () => {
    expect(formatRelativeTime(beforeNow(5 * 60 * 60), opts)).toBe('5 hours ago');
  });

  it('stays in hours just under a day', () => {
    expect(formatRelativeTime(beforeNow(23 * 60 * 60), opts)).toBe(
      '23 hours ago'
    );
  });
});

describe('formatRelativeTime — days and beyond (#993)', () => {
  it('switches to days at the 24-hour boundary', () => {
    expect(formatRelativeTime(beforeNow(24 * 60 * 60), opts)).toBe('1 day ago');
  });

  it('renders plural days', () => {
    expect(formatRelativeTime(beforeNow(3 * 24 * 60 * 60), opts)).toBe(
      '3 days ago'
    );
  });

  it('renders weeks beyond a week', () => {
    expect(formatRelativeTime(beforeNow(10 * 24 * 60 * 60), opts)).toBe(
      '1 week ago'
    );
  });

  it('renders months beyond a month', () => {
    expect(formatRelativeTime(beforeNow(60 * 24 * 60 * 60), opts)).toBe(
      '2 months ago'
    );
  });

  it('renders years beyond a year', () => {
    expect(formatRelativeTime(beforeNow(400 * 24 * 60 * 60), opts)).toBe(
      '1 year ago'
    );
  });
});

describe('formatRelativeTime — future dates (#993)', () => {
  it('phrases the future with "in ..."', () => {
    expect(formatRelativeTime(beforeNow(-5 * 60), opts)).toBe('in 5 minutes');
  });

  it('handles a future hour', () => {
    expect(formatRelativeTime(beforeNow(-2 * 60 * 60), opts)).toBe('in 2 hours');
  });

  it('handles a future day', () => {
    expect(formatRelativeTime(beforeNow(-3 * 24 * 60 * 60), opts)).toBe(
      'in 3 days'
    );
  });

  it('renders "just now" for the near future too', () => {
    expect(formatRelativeTime(beforeNow(-10), opts)).toBe('just now');
  });
});

describe('formatRelativeTime — invalid inputs (#993)', () => {
  it('returns the placeholder for null/undefined/empty', () => {
    expect(formatRelativeTime(null, opts)).toBe(INVALID_TIME_PLACEHOLDER);
    expect(formatRelativeTime(undefined, opts)).toBe(INVALID_TIME_PLACEHOLDER);
    expect(formatRelativeTime('', opts)).toBe(INVALID_TIME_PLACEHOLDER);
  });

  it('returns the placeholder for unparseable strings', () => {
    expect(formatRelativeTime('not-a-date', opts)).toBe(
      INVALID_TIME_PLACEHOLDER
    );
  });

  it('returns the placeholder for an invalid Date instance', () => {
    expect(formatRelativeTime(new Date('nope'), opts)).toBe(
      INVALID_TIME_PLACEHOLDER
    );
  });

  it('honours a custom fallback', () => {
    expect(
      formatRelativeTime(null, { ...opts, fallback: 'unknown' })
    ).toBe('unknown');
  });

  it('never throws for garbage input', () => {
    expect(() => formatRelativeTime({} as unknown, opts)).not.toThrow();
    expect(formatRelativeTime(NaN as unknown, opts)).toBe(
      INVALID_TIME_PLACEHOLDER
    );
  });
});

describe('parseDate (#993)', () => {
  it('parses ISO strings and epoch milliseconds', () => {
    expect(parseDate('2026-10-19T12:00:00.000Z')?.toISOString()).toBe(
      '2026-10-19T12:00:00.000Z'
    );
    expect(parseDate(NOW.getTime())?.getTime()).toBe(NOW.getTime());
  });

  it('passes Date instances through', () => {
    expect(parseDate(NOW)).toBe(NOW);
  });

  it('returns null for invalid values', () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(parseDate('nonsense')).toBeNull();
  });
});

describe('absolute formatting (#993)', () => {
  it('formats a locale-aware date', () => {
    expect(formatAbsoluteDate(NOW, 'en-US')).toBe('Oct 19, 2026');
  });

  it('formats a locale-aware date and time', () => {
    const formatted = formatAbsoluteDateTime(NOW, 'en-US');
    expect(formatted).toContain('Oct 19, 2026');
    // Present regardless of the 12- or 24-hour convention of the locale/zone.
    expect(formatted).toMatch(/12:00|01:00/);
  });

  it('formatTimestamp mirrors the date-time rendering', () => {
    expect(formatTimestamp(NOW, 'en-US')).toBe(
      formatAbsoluteDateTime(NOW, 'en-US')
    );
  });

  it('falls back for invalid input on every absolute helper', () => {
    expect(formatAbsoluteDate('x', 'en-US')).toBe(INVALID_TIME_PLACEHOLDER);
    expect(formatAbsoluteDateTime('x', 'en-US')).toBe(
      INVALID_TIME_PLACEHOLDER
    );
    expect(formatTimestamp('x', 'en-US')).toBe(INVALID_TIME_PLACEHOLDER);
  });

  it('returns a timezone abbreviation and falls back when invalid', () => {
    expect(getTimeZoneAbbreviation(NOW, 'en-US')).toBeTruthy();
    expect(getTimeZoneAbbreviation('x', 'en-US')).toBe(
      INVALID_TIME_PLACEHOLDER
    );
  });
});
