import { describe, it, expect } from 'vitest';
import { formatDate, parseInputDate, isWithinRange, buildMonthMatrix } from './DateRangePicker';

describe('DateRangePicker utils', () => {
  describe('formatDate', () => {
    it('formats a Date to ISO string at midnight', () => {
      const d = new Date('2024-06-15T10:30:00');
      expect(formatDate(d)).toBe('2024-06-15');
    });
  });

  describe('parseInputDate', () => {
    it('parses a valid ISO date string', () => {
      expect(parseInputDate('2024-06-15')).not.toBeNull();
    });

    it('returns null for an invalid string', () => {
      expect(parseInputDate('not-a-date')).toBeNull();
    });
  });

  describe('isWithinRange', () => {
    it('returns true when no range is specified', () => {
      expect(isWithinRange('2024-06-15', { from: null, to: null })).toBe(true);
    });

    it('returns true when date is within the range', () => {
      expect(
        isWithinRange('2024-06-20', { from: '2024-06-15', to: '2024-06-25' })
      ).toBe(true);
    });

    it('returns false when date is before the range', () => {
      expect(
        isWithinRange('2024-06-10', { from: '2024-06-15', to: '2024-06-25' })
      ).toBe(false);
    });

    it('returns false when date is after the range', () => {
      expect(
        isWithinRange('2024-07-01', { from: '2024-06-15', to: '2024-06-25' })
      ).toBe(false);
    });
  });

  describe('buildMonthMatrix', () => {
    it('builds a 6×7 matrix for a given month', () => {
      const matrix = buildMonthMatrix(5, 2024); // June 2024
      expect(matrix).toHaveLength(6);
      matrix.forEach((row) => expect(row).toHaveLength(7));
    });

    it('includes leading/trailing days from adjacent months', () => {
      const matrix = buildMonthMatrix(1, 2024); // February 2024 (leap year)
      expect(matrix).toHaveLength(6);
    });
  });
});