import { describe, it, expect } from 'vitest';

import {
  aggregateLatencyByDay,
  buildLatencyPlot,
  LATENCY_SPIKE_THRESHOLD_MS,
  percentile,
  summarizeLatency,
  toLatencyWindow,
  toPolylinePoints,
  toUtcDateKey,
} from '@/lib/webhookLatency';
import type { WebhookDelivery } from '@/types/webhook';

const delivery = (
  createdAt: string,
  latencyMs: number | string | undefined
): WebhookDelivery =>
  ({
    id: `${createdAt}-${latencyMs}`,
    webhook_id: 'w1',
    event: 'outage.created',
    status: 'success',
    response_code: 200,
    created_at: createdAt,
    latency_ms: latencyMs,
  }) as WebhookDelivery;

describe('toUtcDateKey', () => {
  it('buckets by UTC calendar day', () => {
    expect(toUtcDateKey('2026-01-15T10:30:00.000Z')).toBe('2026-01-15');
    // 23:30 UTC belongs to the same day even though a local zone may differ.
    expect(toUtcDateKey('2026-01-15T23:30:00.000Z')).toBe('2026-01-15');
  });

  it('returns null for missing or invalid timestamps', () => {
    expect(toUtcDateKey(null)).toBeNull();
    expect(toUtcDateKey('not-a-date')).toBeNull();
  });
});

describe('percentile', () => {
  it('uses nearest-rank on a pre-sorted array', () => {
    const sorted = [1, 2, 3, 4, 5];
    expect(percentile(sorted, 50)).toBe(3);
    expect(percentile(sorted, 95)).toBe(5);
    expect(percentile(sorted, 100)).toBe(5);
  });

  it('returns 0 for an empty array', () => {
    expect(percentile([], 95)).toBe(0);
  });
});

describe('aggregateLatencyByDay', () => {
  const samples = [
    delivery('2026-01-13T01:00:00Z', 100),
    delivery('2026-01-13T02:00:00Z', 300),
    delivery('2026-01-14T01:00:00Z', 500),
    delivery('2026-01-14T02:00:00Z', 2500),
    delivery('2026-01-15T01:00:00Z', 2000),
  ];

  it('computes a daily average, p95, max, and count', () => {
    const result = aggregateLatencyByDay(samples);
    expect(result[0]).toEqual({
      date: '2026-01-13',
      averageMs: 200,
      p95Ms: 300,
      maxMs: 300,
      count: 2,
      isSpike: false,
    });
  });

  it('flags a day whose average exceeds the 1000ms threshold', () => {
    const result = aggregateLatencyByDay(samples);
    expect(result[1]).toMatchObject({
      date: '2026-01-14',
      averageMs: 1500,
      isSpike: true,
    });
    expect(result[2]).toMatchObject({ averageMs: 2000, isSpike: true });
  });

  it('does not flag a day whose average is exactly the threshold', () => {
    const exact = aggregateLatencyByDay([
      delivery('2026-01-13T00:00:00Z', 500),
      delivery('2026-01-13T01:00:00Z', 1500),
    ]);
    expect(exact[0].averageMs).toBe(LATENCY_SPIKE_THRESHOLD_MS);
    expect(exact[0].isSpike).toBe(false);
  });

  it('honours a custom threshold', () => {
    const result = aggregateLatencyByDay(samples, { thresholdMs: 100 });
    expect(result[0].isSpike).toBe(true);
  });

  it('sorts days chronologically regardless of input order', () => {
    const shuffled = [
      delivery('2026-01-15T01:00:00Z', 2000),
      delivery('2026-01-13T01:00:00Z', 100),
    ];
    expect(aggregateLatencyByDay(shuffled).map((s) => s.date)).toEqual([
      '2026-01-13',
      '2026-01-15',
    ]);
  });

  it('ignores dispatches with no recorded latency', () => {
    expect(
      aggregateLatencyByDay([delivery('2026-01-13T00:00:00Z', undefined)])
    ).toHaveLength(0);
  });

  it('reads a stringified latency', () => {
    const result = aggregateLatencyByDay([
      delivery('2026-01-13T00:00:00Z', '250'),
    ]);
    expect(result[0].averageMs).toBe(250);
  });

  it('omits days with no dispatches rather than plotting a zero', () => {
    const result = aggregateLatencyByDay([
      delivery('2026-01-13T00:00:00Z', 100),
      delivery('2026-01-15T00:00:00Z', 100),
    ]);
    expect(result.map((s) => s.date)).toEqual(['2026-01-13', '2026-01-15']);
  });

  it('handles an empty input', () => {
    expect(aggregateLatencyByDay([])).toEqual([]);
  });
});

describe('toLatencyWindow', () => {
  const samples = [
    { date: '2026-01-11', averageMs: 1, p95Ms: 1, maxMs: 1, count: 1, isSpike: false },
    { date: '2026-01-12', averageMs: 2, p95Ms: 2, maxMs: 2, count: 1, isSpike: false },
    { date: '2026-01-13', averageMs: 3, p95Ms: 3, maxMs: 3, count: 1, isSpike: false },
  ];

  it('keeps the most recent days', () => {
    expect(toLatencyWindow(samples, 2).map((s) => s.date)).toEqual([
      '2026-01-12',
      '2026-01-13',
    ]);
  });

  it('defaults to a 7 day window', () => {
    expect(toLatencyWindow(samples)).toHaveLength(3);
  });

  it('never returns fewer than one day', () => {
    expect(toLatencyWindow(samples, 0)).toHaveLength(1);
  });
});

describe('buildLatencyPlot', () => {
  const samples = [
    { date: '2026-01-13', averageMs: 100, p95Ms: 100, maxMs: 100, count: 1, isSpike: false },
    { date: '2026-01-14', averageMs: 2000, p95Ms: 2000, maxMs: 2000, count: 1, isSpike: true },
  ];

  it('places one point per sample', () => {
    expect(buildLatencyPlot(samples).points).toHaveLength(2);
  });

  it('positions higher latency higher on the chart', () => {
    const plot = buildLatencyPlot(samples);
    // Lower y is higher up, so the 2000ms point must have the smaller y.
    expect(plot.points[1].y).toBeLessThan(plot.points[0].y);
  });

  it('leaves headroom above the highest point so it is not clipped', () => {
    const plot = buildLatencyPlot(samples);
    expect(plot.maxMs).toBeGreaterThan(2000);
  });

  it('keeps the threshold line inside the plot area', () => {
    const plot = buildLatencyPlot(samples);
    expect(plot.thresholdY).toBeGreaterThan(0);
    expect(plot.thresholdY).toBeLessThan(plot.height);
  });

  it('does not divide by zero with no samples or a zero peak', () => {
    expect(() => buildLatencyPlot([])).not.toThrow();
    const zero = buildLatencyPlot([
      { date: '2026-01-13', averageMs: 0, p95Ms: 0, maxMs: 0, count: 1, isSpike: false },
    ]);
    expect(zero.maxMs).toBeGreaterThan(0);
    expect(Number.isFinite(zero.points[0].y)).toBe(true);
  });

  it('renders a polyline with one coordinate pair per sample', () => {
    const plot = buildLatencyPlot(samples);
    expect(toPolylinePoints(plot).split(' ')).toHaveLength(2);
  });
});

describe('summarizeLatency', () => {
  it('describes an empty series', () => {
    expect(summarizeLatency([])).toBe('No latency data recorded.');
  });

  it('reports the peak day and the spike count', () => {
    const summary = summarizeLatency([
      { date: '2026-01-13', averageMs: 100, p95Ms: 100, maxMs: 100, count: 2, isSpike: false },
      { date: '2026-01-14', averageMs: 2000, p95Ms: 2000, maxMs: 2000, count: 3, isSpike: true },
    ]);
    expect(summary).toContain('2 days of data across 5 dispatches');
    expect(summary).toContain('Peak daily average 2000ms on 2026-01-14');
    expect(summary).toContain('1 day exceeded the 1000ms threshold');
  });

  it('omits the spike sentence when nothing spiked', () => {
    const summary = summarizeLatency([
      { date: '2026-01-13', averageMs: 100, p95Ms: 100, maxMs: 100, count: 1, isSpike: false },
    ]);
    expect(summary).not.toContain('exceeded');
  });

  it('uses singular wording for a single day', () => {
    const summary = summarizeLatency([
      { date: '2026-01-13', averageMs: 100, p95Ms: 100, maxMs: 100, count: 1, isSpike: false },
    ]);
    expect(summary).toContain('1 day of data across 1 dispatch');
  });
});
