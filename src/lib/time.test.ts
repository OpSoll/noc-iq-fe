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

describe('time formatting (#973)', () => {
  const now = new Date('2026-10-19T12:00:00.000Z');

  describe('parseDate', () => {
    it('parses ISO strings and Date instances', () => {
      expect(parseDate('2026-10-19T12:00:00.000Z')?.toISOString()).toBe(
        '2026-10-19T12:00:00.000Z'
      );
      expect(parseDate(now)?.getTime()).toBe(now.getTime());
    });

    it('parses epoch milliseconds', () => {
      expect(parseDate(now.getTime())?.getTime()).toBe(now.getTime());
    });

    it('returns null for null/undefined/empty/invalid', () => {
      expect(parseDate(null)).toBeNull();
      expect(parseDate(undefined)).toBeNull();
      expect(parseDate('')).toBeNull();
      expect(parseDate('not-a-date')).toBeNull();
    });
  });

  describe('formatRelativeTime', () => {
    const rel = (iso: string) => formatRelativeTime(iso, { now, locale: 'en' });

    it('renders recent timestamps as "just now"', () => {
      expect(rel('2026-10-19T11:59:45.000Z')).toBe('just now');
    });

    it('renders past timestamps with "ago" across units', () => {
      expect(rel('2026-10-19T11:55:00.000Z')).toBe('5 minutes ago');
      expect(rel('2026-10-19T09:00:00.000Z')).toBe('3 hours ago');
      expect(rel('2026-10-16T12:00:00.000Z')).toBe('3 days ago');
      expect(rel('2026-10-05T12:00:00.000Z')).toBe('2 weeks ago');
    });

    it('renders future timestamps with "in"', () => {
      expect(rel('2026-10-19T12:10:00.000Z')).toBe('in 10 minutes');
      expect(rel('2026-10-22T12:00:00.000Z')).toBe('in 3 days');
    });

    it('handles invalid input with the placeholder', () => {
      expect(formatRelativeTime(null)).toBe(INVALID_TIME_PLACEHOLDER);
      expect(formatRelativeTime('nope')).toBe(INVALID_TIME_PLACEHOLDER);
    });

    it('honours a custom fallback', () => {
      expect(formatRelativeTime(undefined, { fallback: 'unknown' })).toBe(
        'unknown'
      );
    });
  });

  describe('absolute formatting', () => {
    it('formats date only', () => {
      expect(formatAbsoluteDate('2026-10-19T12:00:00.000Z', {
        locale: 'en-US',
        timeZone: 'UTC',
      })).toBe('10/19/2026');
    });

    it('formats date + time deterministically in UTC', () => {
      expect(
        formatAbsoluteDateTime('2026-10-19T20:15:00.000Z', {
          locale: 'en-US',
          timeZone: 'UTC',
        })
      ).toBe('10/19/2026, 8:15:00 PM');
    });

    it('falls back on invalid input', () => {
      expect(formatAbsoluteDate('nope')).toBe(INVALID_TIME_PLACEHOLDER);
      expect(formatAbsoluteDateTime(null)).toBe(INVALID_TIME_PLACEHOLDER);
      expect(formatTimestamp(undefined)).toBe(INVALID_TIME_PLACEHOLDER);
    });
  });

  describe('getTimeZoneAbbreviation', () => {
    it('returns a timezone label for a valid timestamp', () => {
      const abbr = getTimeZoneAbbreviation(now, 'en-US');
      expect(abbr).toBeTruthy();
      expect(typeof abbr).toBe('string');
    });

    it('returns null for invalid input', () => {
      expect(getTimeZoneAbbreviation('nope')).toBeNull();
    });
  });
});
