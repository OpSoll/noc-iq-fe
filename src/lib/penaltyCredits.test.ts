import { describe, it, expect } from 'vitest';
import { calculatePenaltyCredits, groupCreditsByContract } from './penaltyCredits';
import type { DashboardMetrics } from '@/types/dashboard';

const dummyTrends = [
  { period: '2026-06-01', compliance_percentage: 95, penalties: 100, rewards: 50 },
  { period: '2026-06-02', compliance_percentage: 97, penalties: 200, rewards: 100 },
  { period: '2026-07-01', compliance_percentage: 93, penalties: 50, rewards: 200 },
  { period: '2026-07-02', compliance_percentage: 90, penalties: 75, rewards: 300 },
];

const dummyMetrics: DashboardMetrics = {
  sla_compliance_percentage: 95,
  penalties: { total: 425, count: 4 },
  rewards: { total: 650, count: 5 },
  trends: dummyTrends,
};

describe('calculatePenaltyCredits', () => {
  it('returns total penalties and monthly breakdown for the current month', () => {
    const result = calculatePenaltyCredits(dummyMetrics, { month: '2026-06' });
    expect(result.total).toBe(300);
    expect(result.monthly.length).toBe(2);
    expect(result.monthly[0].penalties).toBe(100);
    expect(result.monthly[1].penalties).toBe(200);
  });

  it('defaults to the current system month when month is unspecified', () => {
    const result = calculatePenaltyCredits(dummyMetrics);
    expect(typeof result.total).toBe('number');
    expect(Array.isArray(result.monthly)).toBe(true);
  });

  it('returns zero total and empty array when there are no trends', () => {
    const metricsNoTrends: DashboardMetrics = {
      ...dummyMetrics,
      trends: [],
    };
    const result = calculatePenaltyCredits(metricsNoTrends);
    expect(result.total).toBe(0);
    expect(result.monthly.length).toBe(0);
  });
});

describe('groupCreditsByContract', () => {
  it('groups penalties across default contract buckets', () => {
    const monthly = [
      { period: '2026-06-01', label: '2026-06-01', penalties: 100 },
      { period: '2026-06-02', label: '2026-06-02', penalties: 200 },
      { period: '2026-07-01', label: '2026-07-01', penalties: 50 },
    ];
    const result = groupCreditsByContract(monthly);
    expect(result.total).toBe(350);
    expect(result.byContract['Contract A']).toBe(100);
    expect(result.byContract['Contract B']).toBe(200);
    expect(result.byContract['Contract C']).toBe(50);
  });

  it('distributes evenly when more points than contract buckets', () => {
    const monthly = [
      { period: '2026-06-01', label: '2026-06-01', penalties: 10 },
      { period: '2026-06-02', label: '2026-06-02', penalties: 20 },
      { period: '2026-06-03', label: '2026-06-03', penalties: 30 },
      { period: '2026-06-04', label: '2026-06-04', penalties: 40 },
    ];
    const result = groupCreditsByContract(monthly);
    expect(result.total).toBe(100);
    // Round-robin: A=10, B=20, C=30, A=40 -> A=50, B=20, C=30
    expect(result.byContract['Contract A']).toBe(50);
    expect(result.byContract['Contract B']).toBe(20);
    expect(result.byContract['Contract C']).toBe(30);
  });

  it('handles empty monthly array', () => {
    const result = groupCreditsByContract([]);
    expect(result.total).toBe(0);
    expect(result.byContract['Contract A']).toBe(0);
    expect(result.byContract['Contract B']).toBe(0);
    expect(result.byContract['Contract C']).toBe(0);
  });
});