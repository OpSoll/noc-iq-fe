import { describe, it, expect } from 'vitest';

import {
  BUDGET_CRITICAL_THRESHOLD,
  BUDGET_WARNING_THRESHOLD,
  allowedDowntimeMinutes,
  computeErrorBudget,
  formatRemainingMinutes,
  riskLevelFor,
} from './errorBudget';

/** 30 days in minutes. */
const MONTH_MINUTES = 30 * 24 * 60;

describe('allowedDowntimeMinutes', () => {
  it('derives the allowance from the target and window length', () => {
    // 0.1% of 43200 minutes.
    expect(allowedDowntimeMinutes(MONTH_MINUTES, 99.9)).toBeCloseTo(43.2, 6);
    expect(allowedDowntimeMinutes(MONTH_MINUTES, 99)).toBeCloseTo(432, 6);
  });

  it('returns null for a 100% target, which allows no downtime at all', () => {
    expect(allowedDowntimeMinutes(MONTH_MINUTES, 100)).toBeNull();
  });

  it('returns null for a 0% target, which allows the whole window', () => {
    expect(allowedDowntimeMinutes(MONTH_MINUTES, 0)).toBeNull();
  });

  it('returns null for a non-positive or invalid window', () => {
    expect(allowedDowntimeMinutes(0, 99.9)).toBeNull();
    expect(allowedDowntimeMinutes(-10, 99.9)).toBeNull();
    expect(allowedDowntimeMinutes(Number.NaN, 99.9)).toBeNull();
  });

  it('returns null for an out-of-range target', () => {
    expect(allowedDowntimeMinutes(MONTH_MINUTES, 120)).toBeNull();
    expect(allowedDowntimeMinutes(MONTH_MINUTES, Number.NaN)).toBeNull();
  });
});

describe('riskLevelFor', () => {
  it('stays healthy below the warning threshold', () => {
    expect(riskLevelFor(0)).toBe('healthy');
    expect(riskLevelFor(74.9)).toBe('healthy');
  });

  it('warns from 75%', () => {
    expect(BUDGET_WARNING_THRESHOLD).toBe(75);
    expect(riskLevelFor(75)).toBe('warning');
    expect(riskLevelFor(89.9)).toBe('warning');
  });

  it('is critical from 90%', () => {
    expect(BUDGET_CRITICAL_THRESHOLD).toBe(90);
    expect(riskLevelFor(90)).toBe('critical');
    expect(riskLevelFor(140)).toBe('critical');
  });

  it('treats a non-finite consumption as healthy rather than alarming', () => {
    expect(riskLevelFor(Number.NaN)).toBe('healthy');
  });
});

describe('computeErrorBudget', () => {
  it('reports consumption, remaining allowance and band', () => {
    const budget = computeErrorBudget(21.6, MONTH_MINUTES, 99.9);

    expect(budget).not.toBeNull();
    expect(budget?.allowedDowntimeMinutes).toBeCloseTo(43.2, 6);
    expect(budget?.consumedPercentage).toBeCloseTo(50, 6);
    expect(budget?.rawConsumedPercentage).toBeCloseTo(50, 6);
    expect(budget?.remainingMinutes).toBeCloseTo(21.6, 6);
    expect(budget?.isExhausted).toBe(false);
    expect(budget?.riskLevel).toBe('healthy');
  });

  it('bands at exactly 75% and 90% consumed', () => {
    const warning = computeErrorBudget(43.2 * 0.75, MONTH_MINUTES, 99.9);
    const critical = computeErrorBudget(43.2 * 0.9, MONTH_MINUTES, 99.9);

    expect(warning?.riskLevel).toBe('warning');
    expect(critical?.riskLevel).toBe('critical');
  });

  it('caps displayed consumption at 100 but keeps the raw overspend', () => {
    const budget = computeErrorBudget(86.4, MONTH_MINUTES, 99.9);

    expect(budget?.consumedPercentage).toBe(100);
    expect(budget?.rawConsumedPercentage).toBeCloseTo(200, 6);
    expect(budget?.riskLevel).toBe('critical');
  });

  it('floors the remaining allowance at zero once exhausted', () => {
    const budget = computeErrorBudget(100, MONTH_MINUTES, 99.9);

    expect(budget?.remainingMinutes).toBe(0);
    expect(budget?.isExhausted).toBe(true);
  });

  it('treats an exhausted budget as reached, not only exceeded', () => {
    const budget = computeErrorBudget(43.2, MONTH_MINUTES, 99.9);

    expect(budget?.isExhausted).toBe(true);
    expect(budget?.remainingMinutes).toBe(0);
  });

  it('treats missing or negative downtime as no downtime', () => {
    expect(
      computeErrorBudget(Number.NaN, MONTH_MINUTES, 99.9)?.downtimeMinutes
    ).toBe(0);
    expect(
      computeErrorBudget(-5, MONTH_MINUTES, 99.9)?.consumedPercentage
    ).toBe(0);
  });

  it('returns null when no budget can be derived', () => {
    expect(computeErrorBudget(10, MONTH_MINUTES, 100)).toBeNull();
    expect(computeErrorBudget(10, 0, 99.9)).toBeNull();
  });
});

describe('formatRemainingMinutes', () => {
  it('renders one decimal place with a unit', () => {
    expect(formatRemainingMinutes(18.44)).toBe('18.4 min remaining');
  });

  it('says the budget is exhausted once nothing is left', () => {
    expect(formatRemainingMinutes(0)).toBe('Budget exhausted');
    expect(formatRemainingMinutes(-1)).toBe('Budget exhausted');
    expect(formatRemainingMinutes(Number.NaN)).toBe('Budget exhausted');
  });
});
