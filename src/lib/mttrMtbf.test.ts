import { describe, it, expect } from 'vitest';

import type { Outage } from '@/types/outages';
import {
  METRIC_NO_DATA,
  compareMetric,
  describeComparison,
  formatMtbfDuration,
  formatMttrDuration,
  meanMttrMinutes,
  meanTimeBetweenFailuresDays,
  percentageChange,
  trendFor,
} from './mttrMtbf';

function makeOutage(overrides: Partial<Outage> = {}): Outage {
  return {
    id: overrides.id ?? 'o1',
    site_name: 'Site A',
    severity: 'high',
    status: 'resolved',
    detected_at: overrides.detected_at ?? '2026-09-01T00:00:00Z',
    resolved_at: overrides.resolved_at,
    description: 'test',
    affected_services: [],
    sla_status: overrides.sla_status,
    ...overrides,
  };
}

/** A resolved outage lasting exactly `minutes`. */
function resolvedOutage(id: string, startIso: string, minutes: number): Outage {
  const start = new Date(startIso).getTime();
  return makeOutage({
    id,
    detected_at: startIso,
    resolved_at: new Date(start + minutes * 60_000).toISOString(),
  });
}

describe('meanMttrMinutes', () => {
  it('averages the resolution times of resolved outages', () => {
    const outages = [
      resolvedOutage('a', '2026-09-01T00:00:00Z', 30),
      resolvedOutage('b', '2026-09-02T00:00:00Z', 90),
    ];

    expect(meanMttrMinutes(outages)).toBe(60);
  });

  it('prefers a recorded SLA result over the timestamp difference', () => {
    const outages = [
      makeOutage({
        detected_at: '2026-09-01T00:00:00Z',
        resolved_at: '2026-09-01T10:00:00Z',
        sla_status: {
          status: 'met',
          mttr_minutes: 12,
          threshold_minutes: 60,
          amount: 10,
          payment_type: 'reward',
          rating: 'good',
        },
      }),
    ];

    expect(meanMttrMinutes(outages)).toBe(12);
  });

  it('ignores outages that have not been resolved', () => {
    const outages = [
      resolvedOutage('a', '2026-09-01T00:00:00Z', 30),
      makeOutage({ id: 'open', status: 'open', resolved_at: undefined }),
    ];

    expect(meanMttrMinutes(outages)).toBe(30);
  });

  it('returns null when nothing can be measured', () => {
    expect(meanMttrMinutes([])).toBeNull();
    expect(
      meanMttrMinutes([makeOutage({ status: 'open', resolved_at: undefined })])
    ).toBeNull();
  });
});

describe('meanTimeBetweenFailuresDays', () => {
  it('averages the gaps between consecutive failures', () => {
    const outages = [
      makeOutage({ id: 'a', detected_at: '2026-09-01T00:00:00Z' }),
      makeOutage({ id: 'b', detected_at: '2026-09-03T00:00:00Z' }),
      makeOutage({ id: 'c', detected_at: '2026-09-07T00:00:00Z' }),
    ];

    // Gaps of 2 and 4 days, mean 3.
    expect(meanTimeBetweenFailuresDays(outages)).toBe(3);
  });

  it('orders failures by detection time regardless of input order', () => {
    const outages = [
      makeOutage({ id: 'c', detected_at: '2026-09-07T00:00:00Z' }),
      makeOutage({ id: 'a', detected_at: '2026-09-01T00:00:00Z' }),
      makeOutage({ id: 'b', detected_at: '2026-09-03T00:00:00Z' }),
    ];

    expect(meanTimeBetweenFailuresDays(outages)).toBe(3);
  });

  it('needs at least two failures to measure an interval', () => {
    expect(meanTimeBetweenFailuresDays([])).toBeNull();
    expect(
      meanTimeBetweenFailuresDays([
        makeOutage({ detected_at: '2026-09-01T00:00:00Z' }),
      ])
    ).toBeNull();
  });

  it('counts concurrent failures as a zero-length gap', () => {
    const outages = [
      makeOutage({ id: 'a', detected_at: '2026-09-01T00:00:00Z' }),
      makeOutage({ id: 'b', detected_at: '2026-09-01T00:00:00Z' }),
    ];

    expect(meanTimeBetweenFailuresDays(outages)).toBe(0);
  });

  it('ignores unparseable detection times', () => {
    const outages = [
      makeOutage({ id: 'a', detected_at: '2026-09-01T00:00:00Z' }),
      makeOutage({ id: 'bad', detected_at: 'not-a-date' }),
      makeOutage({ id: 'b', detected_at: '2026-09-03T00:00:00Z' }),
    ];

    expect(meanTimeBetweenFailuresDays(outages)).toBe(2);
  });
});

describe('percentageChange', () => {
  it('is positive when the value grew', () => {
    expect(percentageChange(150, 100)).toBe(50);
  });

  it('is negative when the value shrank', () => {
    expect(percentageChange(50, 100)).toBe(-50);
  });

  it('is zero for an unchanged value', () => {
    expect(percentageChange(100, 100)).toBe(0);
  });

  it('returns null when either side is missing', () => {
    expect(percentageChange(null, 100)).toBeNull();
    expect(percentageChange(100, null)).toBeNull();
  });

  it('returns null against a zero baseline instead of Infinity', () => {
    expect(percentageChange(10, 0)).toBeNull();
  });

  it('treats a negative baseline by magnitude', () => {
    expect(percentageChange(-50, -100)).toBe(50);
  });
});

describe('trendFor', () => {
  it('treats a fall as improvement when lower is better', () => {
    expect(trendFor(-10, true)).toBe('improving');
    expect(trendFor(10, true)).toBe('degrading');
  });

  it('treats a rise as improvement when higher is better', () => {
    expect(trendFor(10, false)).toBe('improving');
    expect(trendFor(-10, false)).toBe('degrading');
  });

  it('reports no movement as flat', () => {
    expect(trendFor(0, true)).toBe('flat');
    expect(trendFor(0, false)).toBe('flat');
  });

  it('reports unknown without a baseline', () => {
    expect(trendFor(null, true)).toBe('unknown');
  });
});

describe('compareMetric', () => {
  it('resolves an improving MTTR (fell) against a degrading MTBF (fell)', () => {
    expect(compareMetric(30, 60, true)).toStrictEqual({
      current: 30,
      previous: 60,
      changePercentage: -50,
      trend: 'improving',
    });
    expect(compareMetric(3, 6, false).trend).toBe('degrading');
  });

  it('reports unknown when there is no previous cycle', () => {
    expect(compareMetric(30, null, true)).toStrictEqual({
      current: 30,
      previous: null,
      changePercentage: null,
      trend: 'unknown',
    });
  });
});

describe('formatMttrDuration', () => {
  it('renders minutes only below an hour', () => {
    expect(formatMttrDuration(45)).toBe('45m');
    expect(formatMttrDuration(1)).toBe('1m');
  });

  it('renders whole hours without a minute part', () => {
    expect(formatMttrDuration(180)).toBe('3h');
  });

  it('renders hours and minutes together', () => {
    expect(formatMttrDuration(135)).toBe('2h 15m');
  });

  it('rounds fractional minutes and carries into hours', () => {
    expect(formatMttrDuration(119.7)).toBe('2h');
    expect(formatMttrDuration(90.4)).toBe('1h 30m');
  });

  it('renders the placeholder for missing or invalid input', () => {
    expect(formatMttrDuration(null)).toBe(METRIC_NO_DATA);
    expect(formatMttrDuration(Number.NaN)).toBe(METRIC_NO_DATA);
    expect(formatMttrDuration(-1)).toBe(METRIC_NO_DATA);
  });
});

describe('formatMtbfDuration', () => {
  it('renders days to one decimal place', () => {
    expect(formatMtbfDuration(3.44)).toBe('3.4 days');
    expect(formatMtbfDuration(12.99)).toBe('13.0 days');
  });

  it('uses the singular for exactly one day', () => {
    expect(formatMtbfDuration(1)).toBe('1.0 day');
  });

  it('renders the placeholder for missing or invalid input', () => {
    expect(formatMtbfDuration(null)).toBe(METRIC_NO_DATA);
    expect(formatMtbfDuration(Number.NaN)).toBe(METRIC_NO_DATA);
    expect(formatMtbfDuration(-2)).toBe(METRIC_NO_DATA);
  });
});

describe('describeComparison', () => {
  it('signs the change and names the baseline', () => {
    expect(describeComparison(compareMetric(150, 100, false))).toBe(
      '+50.0% vs previous cycle'
    );
    expect(describeComparison(compareMetric(50, 100, true))).toBe(
      '-50.0% vs previous cycle'
    );
  });

  it('says so plainly when there is no baseline', () => {
    expect(describeComparison(compareMetric(30, null, true))).toBe(
      'No prior cycle to compare'
    );
  });
});
