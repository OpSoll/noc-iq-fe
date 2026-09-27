import { describe, it, expect } from 'vitest';

import {
  BASE_RESERVE_STROOPS,
  LOW_BALANCE_WARNING_XLM,
  STROOPS_PER_XLM,
  calculateAvailableBalance,
  calculateMinimumReserve,
  formatXlm,
  isLowAvailableBalance,
} from '@/lib/stellarReserve';

describe('calculateMinimumReserve', () => {
  it('uses the protocol formula (2 + subentries) * baseReserve', () => {
    // 0.5 XLM per entry, 2 base entries, so an empty account reserves 1 XLM.
    expect(calculateMinimumReserve(0).minimumReserveXlm).toBe(1);
    expect(calculateMinimumReserve(0).minimumReserveStroops).toBe(10_000_000);

    // 10 subentries -> 12 entries * 0.5 XLM = 6 XLM.
    expect(calculateMinimumReserve(10).minimumReserveXlm).toBe(6);
    expect(calculateMinimumReserve(10).subentryCount).toBe(10);
  });

  it('scales linearly with subentry count', () => {
    expect(calculateMinimumReserve(1).minimumReserveXlm).toBe(1.5);
    expect(calculateMinimumReserve(100).minimumReserveXlm).toBe(51);
    expect(calculateMinimumReserve(1000).minimumReserveXlm).toBe(501);
  });

  it('exposes the base reserve in XLM', () => {
    expect(calculateMinimumReserve(0).baseReserveXlm).toBe(0.5);
    expect(BASE_RESERVE_STROOPS).toBe(0.5 * STROOPS_PER_XLM);
  });

  it('honours a network-specific baseReserve override', () => {
    // A 1 XLM base reserve doubles the requirement.
    expect(calculateMinimumReserve(0, 10_000_000).minimumReserveXlm).toBe(2);
    expect(calculateMinimumReserve(10, 10_000_000).minimumReserveXlm).toBe(12);
  });

  it('clamps negative and fractional subentry counts', () => {
    expect(calculateMinimumReserve(-5).subentryCount).toBe(0);
    expect(calculateMinimumReserve(3.9).subentryCount).toBe(3);
  });
});

describe('calculateAvailableBalance', () => {
  it('subtracts the reserve from the total balance', () => {
    const result = calculateAvailableBalance(100, 10);
    // 100 XLM held, 6 XLM reserved.
    expect(result.minimumReserveXlm).toBe(6);
    expect(result.availableBalanceXlm).toBe(94);
    expect(result.totalBalanceXlm).toBe(100);
    expect(result.isBelowMinimum).toBe(false);
  });

  it('flags an account that cannot cover its own reserve', () => {
    // 0.5 XLM total but 1 XLM required.
    const result = calculateAvailableBalance(0.5, 0);
    expect(result.availableBalanceXlm).toBe(0);
    expect(result.isBelowMinimum).toBe(true);
  });

  it('clamps a negative available balance to zero', () => {
    const result = calculateAvailableBalance(0.1, 0);
    expect(result.availableBalanceXlm).toBe(0);
    expect(result.isBelowMinimum).toBe(true);
  });

  it('catches the case that motivates the badge: high total, high reserve', () => {
    // 500 XLM held but 1,000 subentries lock up 501 XLM of reserve.
    const result = calculateAvailableBalance(500, 1000);
    expect(result.totalBalanceXlm).toBe(500);
    expect(result.minimumReserveXlm).toBe(501);
    expect(result.availableBalanceXlm).toBe(0);
    expect(result.isBelowMinimum).toBe(true);
  });

  it('treats a non-finite total as zero', () => {
    expect(calculateAvailableBalance(Number.NaN, 0).totalBalanceXlm).toBe(0);
    expect(
      calculateAvailableBalance(Number.POSITIVE_INFINITY, 0).totalBalanceXlm
    ).toBe(0);
  });
});

describe('isLowAvailableBalance', () => {
  it('warns strictly below the threshold', () => {
    expect(isLowAvailableBalance(1.99)).toBe(true);
    expect(isLowAvailableBalance(2)).toBe(false);
    expect(isLowAvailableBalance(10)).toBe(false);
  });

  it('defaults to a 2 XLM threshold', () => {
    expect(LOW_BALANCE_WARNING_XLM).toBe(2);
  });

  it('accepts a custom threshold', () => {
    expect(isLowAvailableBalance(10, 20)).toBe(true);
    expect(isLowAvailableBalance(30, 20)).toBe(false);
  });
});

describe('formatXlm', () => {
  it('converts stroops to XLM', () => {
    expect(formatXlm(10_000_000)).toBe('1');
    expect(formatXlm(15_000_000)).toBe('1.5');
    expect(formatXlm(1)).toBe('0.0000001');
  });

  it('trims trailing zeros', () => {
    expect(formatXlm(10_500_000)).toBe('1.05');
    expect(formatXlm(10_000_001)).toBe('1.0000001');
  });

  it('handles zero, negatives, and non-finite input', () => {
    expect(formatXlm(0)).toBe('0');
    expect(formatXlm(-10_000_000)).toBe('-1');
    expect(formatXlm(Number.NaN)).toBe('0');
  });

  it('respects a maximum decimal precision', () => {
    // 12_345_678 stroops is 1.2345678 XLM. The value is truncated, not rounded.
    expect(formatXlm(12_345_678, 2)).toBe('1.23');
    expect(formatXlm(12_345_678, 3)).toBe('1.234');
  });
});
