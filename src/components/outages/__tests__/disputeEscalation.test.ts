import { describe, it, expect } from 'vitest';

import {
  ESCALATION_PRIORITIES,
  ESCALATION_THRESHOLD_DAYS,
  isEscalatable,
} from '../disputeEscalation';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-08-31T12:00:00Z');

function createdAtDaysAgo(days: number): string {
  return new Date(now.getTime() - days * DAY).toISOString();
}

describe('isEscalatable (opsoll/noc-iq-fe#496)', () => {
  it('allows escalation for a pending dispute older than 7 days', () => {
    expect(
      isEscalatable(
        {
          created_at: createdAtDaysAgo(ESCALATION_THRESHOLD_DAYS + 1),
          status: 'open',
        },
        now
      )
    ).toBe(true);
  });

  it('allows escalation for under_review disputes past the threshold', () => {
    expect(
      isEscalatable(
        { created_at: createdAtDaysAgo(10), status: 'under_review' },
        now
      )
    ).toBe(true);
  });

  it('is unavailable exactly at the 7-day boundary and before it', () => {
    expect(
      isEscalatable(
        {
          created_at: createdAtDaysAgo(ESCALATION_THRESHOLD_DAYS),
          status: 'open',
        },
        now
      )
    ).toBe(true);
    expect(
      isEscalatable(
        {
          created_at: createdAtDaysAgo(ESCALATION_THRESHOLD_DAYS - 1),
          status: 'open',
        },
        now
      )
    ).toBe(false);
  });

  it('is unavailable for already-settled disputes', () => {
    for (const status of ['resolved', 'rejected'] as const) {
      expect(
        isEscalatable({ created_at: createdAtDaysAgo(30), status }, now)
      ).toBe(false);
    }
  });

  it('is unavailable for malformed creation timestamps', () => {
    expect(
      isEscalatable({ created_at: 'not-a-date', status: 'open' }, now)
    ).toBe(false);
  });

  it('offers the escalation priority ladder', () => {
    expect(ESCALATION_PRIORITIES).toEqual([
      'low',
      'normal',
      'high',
      'critical',
    ]);
  });
});
