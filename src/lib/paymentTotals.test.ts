import { describe, expect, it } from 'vitest';

import { formatTotal, summarizePayments } from './paymentTotals';
import type { Payment } from '@/types/payment';

/**
 * #1005 — sticky totals row for the payments table.
 */
function payment(overrides: Partial<Payment>): Payment {
  return {
    id: 'p1',
    outageId: null,
    type: 'reward',
    amount: '0',
    amountValue: 0,
    assetCode: 'USDC',
    transactionHash: null,
    fromAddress: null,
    toAddress: null,
    status: 'confirmed',
    createdAt: '2026-10-19T12:00:00.000Z',
    ...overrides,
  };
}

describe('summarizePayments (#1005)', () => {
  it('returns zeroed totals for an empty list', () => {
    expect(summarizePayments([])).toEqual({
      rewards: 0,
      penalties: 0,
      net: 0,
      count: 0,
      assetCode: null,
    });
  });

  it('sums rewards and penalties separately', () => {
    const result = summarizePayments([
      payment({ id: 'a', type: 'reward', amountValue: 100 }),
      payment({ id: 'b', type: 'reward', amountValue: 50 }),
      payment({ id: 'c', type: 'penalty', amountValue: 30 }),
    ]);
    expect(result.rewards).toBe(150);
    expect(result.penalties).toBe(30);
    expect(result.net).toBe(120);
    expect(result.count).toBe(3);
  });

  it('treats non-penalty types (manual, unknown) as rewards', () => {
    const result = summarizePayments([
      payment({ id: 'a', type: 'manual', amountValue: 10 }),
      payment({ id: 'b', type: 'something', amountValue: 5 }),
    ]);
    expect(result.rewards).toBe(15);
    expect(result.penalties).toBe(0);
  });

  it('applies the penalty sign only to the net total', () => {
    const result = summarizePayments([
      payment({ id: 'c', type: 'penalty', amountValue: 30 }),
    ]);
    expect(result.penalties).toBe(30);
    expect(result.net).toBe(-30);
  });

  it('ignores missing/invalid amount values', () => {
    const result = summarizePayments([
      payment({ id: 'a', amountValue: Number.NaN }),
      payment({ id: 'b', amountValue: undefined as unknown as number }),
      payment({ id: 'c', type: 'reward', amountValue: 20 }),
    ]);
    expect(result.rewards).toBe(20);
    expect(result.count).toBe(3);
  });

  it('reports a single asset code', () => {
    const result = summarizePayments([
      payment({ id: 'a', assetCode: 'USDC' }),
      payment({ id: 'b', assetCode: 'USDC' }),
    ]);
    expect(result.assetCode).toBe('USDC');
  });

  it('reports null when asset codes are mixed', () => {
    const result = summarizePayments([
      payment({ id: 'a', assetCode: 'USDC' }),
      payment({ id: 'b', assetCode: 'XLM' }),
    ]);
    expect(result.assetCode).toBeNull();
  });
});

describe('formatTotal (#1005)', () => {
  it('formats whole numbers without cents', () => {
    expect(formatTotal(1200)).toBe('$1,200');
  });

  it('formats fractional values with two decimals', () => {
    expect(formatTotal(1234.5)).toBe('$1,234.50');
  });

  it('keeps the sign for negative nets', () => {
    expect(formatTotal(-30)).toBe('$-30');
  });

  it('uses the asset code as the prefix when known', () => {
    expect(formatTotal(100, 'USDC')).toBe('USDC 100');
  });
});
