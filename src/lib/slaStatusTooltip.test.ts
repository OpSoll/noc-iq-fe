import { describe, expect, it } from 'vitest';
import type { SLAResult } from '@/types/sla';
import {
  getSlaAmountTooltip,
  getSlaRatingTooltip,
  getSlaStatusBadgeTooltip,
  getSlaStatusTooltip,
  SLA_TOOLTIP_FALLBACK,
} from './slaStatusTooltip';

/**
 * #985 — SLA status tooltip on the outage detail badges.
 */

const met: SLAResult = {
  status: 'met',
  mttr_minutes: 12,
  threshold_minutes: 30,
  amount: 25,
  payment_type: 'reward',
  rating: 'excellent',
};

const violated: SLAResult = {
  status: 'violated',
  mttr_minutes: 95,
  threshold_minutes: 60,
  amount: -50,
  payment_type: 'penalty',
  rating: 'poor',
};

describe('getSlaStatusTooltip (#985)', () => {
  it('explains a met SLA with the computed numbers', () => {
    const text = getSlaStatusTooltip(met);
    expect(text).toContain('met');
    expect(text).toContain('12m');
    expect(text).toContain('30m');
  });

  it('explains a violated SLA with the computed numbers', () => {
    const text = getSlaStatusTooltip(violated);
    expect(text).toContain('violated');
    expect(text).toContain('1h 35m');
    expect(text).toContain('1h threshold');
  });

  it('formats long durations as hours and minutes', () => {
    const long: SLAResult = { ...violated, mttr_minutes: 125 };
    expect(getSlaStatusTooltip(long)).toContain('2h 5m');
  });

  it('uses the reason-code explanation when one is supplied', () => {
    const text = getSlaStatusTooltip(violated, 'MTTR_EXCEEDED');
    expect(text).toContain('Mean time to repair exceeded the SLA threshold.');
  });

  it('falls back to the outcome text when the reason code is unknown', () => {
    const text = getSlaStatusTooltip(violated, 'SOMETHING_NEW');
    expect(text).toContain('violated');
    expect(text).not.toContain('SOMETHING_NEW');
  });

  it('falls back when the reason code is missing', () => {
    expect(getSlaStatusTooltip(violated, null)).toContain('violated');
    expect(getSlaStatusTooltip(violated, undefined)).toContain('violated');
    expect(getSlaStatusTooltip(violated, '')).toContain('violated');
  });

  it('falls back to a generic sentence for a null result', () => {
    expect(getSlaStatusTooltip(null)).toBe(SLA_TOOLTIP_FALLBACK);
    expect(getSlaStatusTooltip(undefined)).toBe(SLA_TOOLTIP_FALLBACK);
  });

  it('omits the MTTR clause when the numbers are unusable', () => {
    const noNumbers: SLAResult = {
      ...met,
      mttr_minutes: Number.NaN,
      threshold_minutes: Number.NaN,
    };
    const text = getSlaStatusTooltip(noNumbers);
    expect(text).toContain('met');
    expect(text).not.toContain('MTTR');
    expect(text).not.toContain('NaN');
  });
});

describe('badge tooltips (#985)', () => {
  it('the status badge tooltip matches the status explanation', () => {
    expect(getSlaStatusBadgeTooltip(violated)).toBe(
      getSlaStatusTooltip(violated)
    );
  });

  it('describes the financial amount and its sign', () => {
    expect(getSlaAmountTooltip(violated)).toContain('penalty');
    expect(getSlaAmountTooltip(violated)).toContain('50');
    expect(getSlaAmountTooltip(met)).toContain('reward');
  });

  it('describes the rating', () => {
    expect(getSlaRatingTooltip(met)).toMatch(/faster|within the SLA window/i);
    expect(getSlaRatingTooltip(violated)).toContain('longer than');
  });

  it('falls back for a null result on every badge tooltip', () => {
    expect(getSlaAmountTooltip(null)).toBe(SLA_TOOLTIP_FALLBACK);
    expect(getSlaRatingTooltip(null)).toBe(SLA_TOOLTIP_FALLBACK);
  });
});
