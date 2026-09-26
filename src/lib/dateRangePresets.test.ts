import { describe, it, expect } from 'vitest';
// Closes #448: unit tests for the SLA dashboard quick-preset date ranges.

import { DATE_RANGE_PRESETS, computePresetRange } from '@/lib/dateRangePresets';

const FIXED_NOW = new Date('2026-08-28T12:00:00Z');

describe('DATE_RANGE_PRESETS', () => {
  it('exposes exactly the four required presets in order', () => {
    expect(DATE_RANGE_PRESETS.map((p) => p.label)).toEqual([
      'Today',
      'Last 7 Days',
      'Last 30 Days',
      'MTD',
    ]);
  });
});

describe('computePresetRange', () => {
  it("resolves 'today' to a single-day window", () => {
    expect(computePresetRange('today', FIXED_NOW)).toEqual({
      date_from: '2026-08-28',
      date_to: '2026-08-28',
    });
  });

  it("resolves 'mtd' to the first of the current month through today", () => {
    expect(computePresetRange('mtd', FIXED_NOW)).toEqual({
      date_from: '2026-08-01',
      date_to: '2026-08-28',
    });
  });

  it("resolves '7d' to seven days before today", () => {
    expect(computePresetRange('7d', FIXED_NOW)).toEqual({
      date_from: '2026-08-21',
      date_to: '2026-08-28',
    });
  });

  it("resolves '30d' to thirty days before today", () => {
    expect(computePresetRange('30d', FIXED_NOW)).toEqual({
      date_from: '2026-07-29',
      date_to: '2026-08-28',
    });
  });
});
