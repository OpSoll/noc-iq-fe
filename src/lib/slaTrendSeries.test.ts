import { describe, it, expect } from 'vitest';

import type { Outage } from '@/types/outages';
import {
  DEFAULT_TREND_WINDOW_DAYS,
  TREND_WINDOW_DAYS,
  buildSlaTrendSeries,
  computeTrendScale,
  resolveTrendWindow,
  scaleX,
  scaleY,
  sliceTrendSeries,
  trendAreaPath,
  type TrendWindow,
} from './slaTrendSeries';

/** 2026-09-01T00:00Z → 2026-09-11T00:00Z: ten whole UTC days. */
const TEN_DAY_WINDOW: TrendWindow = {
  from: new Date('2026-09-01T00:00:00Z'),
  to: new Date('2026-09-11T00:00:00Z'),
};

function makeOutage(overrides: Partial<Outage> = {}): Outage {
  return {
    id: overrides.id ?? 'o1',
    site_name: 'Site A',
    severity: 'high',
    status: overrides.status ?? 'resolved',
    detected_at: overrides.detected_at ?? '2026-09-01T00:00:00Z',
    resolved_at: overrides.resolved_at,
    description: 'test',
    affected_services: [],
    ...overrides,
  };
}

function resolvedOutage(id: string, startIso: string, minutes: number): Outage {
  return makeOutage({
    id,
    detected_at: startIso,
    resolved_at: new Date(
      new Date(startIso).getTime() + minutes * 60_000
    ).toISOString(),
  });
}

describe('resolveTrendWindow', () => {
  const NOW = new Date('2026-09-28T12:00:00Z');

  it('uses an explicit range with an exclusive upper bound', () => {
    const window = resolveTrendWindow('2026-09-01', '2026-09-10', NOW);

    expect(window.from.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(window.to.toISOString()).toBe('2026-09-11T00:00:00.000Z');
  });

  it('runs from the lower bound up to now when only a start is given', () => {
    const window = resolveTrendWindow('2026-09-01', undefined, NOW);

    expect(window.to).toBe(NOW);
  });

  it('defaults to a trailing window when no filter is applied', () => {
    const window = resolveTrendWindow(undefined, undefined, NOW);

    expect(window.to).toBe(NOW);
    expect(window.to.getTime() - window.from.getTime()).toBe(
      DEFAULT_TREND_WINDOW_DAYS * 86_400_000
    );
  });

  it('falls back to the default window for unparseable values', () => {
    const window = resolveTrendWindow('nope', 'nope', NOW);

    expect(window.to).toBe(NOW);
  });

  it('describes a single-day filter as a full day', () => {
    const window = resolveTrendWindow('2026-09-10', '2026-09-10', NOW);

    expect(window.to.getTime() - window.from.getTime()).toBe(86_400_000);
  });
});

describe('buildSlaTrendSeries', () => {
  it('produces one bucket per UTC day in the window', () => {
    const series = buildSlaTrendSeries([], TEN_DAY_WINDOW);

    expect(series).toHaveLength(10);
    expect(series[0].date).toBe('2026-09-01');
    expect(series[9].date).toBe('2026-09-10');
  });

  it('reports a perfect day when nothing failed', () => {
    const series = buildSlaTrendSeries([], TEN_DAY_WINDOW);

    expect(series[0]).toStrictEqual({
      date: '2026-09-01',
      availabilityPercentage: 100,
      outageCount: 0,
      downtimeMinutes: 0,
    });
  });

  it('converts a day of downtime into availability', () => {
    const series = buildSlaTrendSeries(
      [resolvedOutage('a', '2026-09-02T00:00:00Z', 60)],
      TEN_DAY_WINDOW
    );

    const day = series[1];
    expect(day.downtimeMinutes).toBe(60);
    expect(day.outageCount).toBe(1);
    // 60 minutes lost out of 1440.
    expect(day.availabilityPercentage).toBeCloseTo(95.833333, 5);
  });

  it('attributes an outage spanning midnight to both days it covered', () => {
    const series = buildSlaTrendSeries(
      [resolvedOutage('a', '2026-09-03T23:30:00Z', 60)],
      TEN_DAY_WINDOW
    );

    const third = series.find((d) => d.date === '2026-09-03');
    const fourth = series.find((d) => d.date === '2026-09-04');

    expect(third?.downtimeMinutes).toBeCloseTo(30, 6);
    expect(fourth?.downtimeMinutes).toBeCloseTo(30, 6);
    expect(third?.outageCount).toBe(1);
    expect(fourth?.outageCount).toBe(1);
  });

  it('counts concurrent outages once against the day they overlap', () => {
    const series = buildSlaTrendSeries(
      [
        resolvedOutage('a', '2026-09-05T01:00:00Z', 120),
        resolvedOutage('b', '2026-09-05T02:00:00Z', 120),
      ],
      TEN_DAY_WINDOW
    );

    const day = series.find((d) => d.date === '2026-09-05');
    // Merged 01:00-04:00 is 180 minutes, not 240.
    expect(day?.downtimeMinutes).toBeCloseTo(180, 6);
    expect(day?.outageCount).toBe(2);
  });

  it('returns no buckets for an empty or inverted window', () => {
    expect(
      buildSlaTrendSeries([], { from: new Date(), to: new Date() })
    ).toEqual([]);
    expect(
      buildSlaTrendSeries([], {
        from: new Date('2026-09-11T00:00:00Z'),
        to: new Date('2026-09-01T00:00:00Z'),
      })
    ).toEqual([]);
  });
});

describe('sliceTrendSeries', () => {
  const series = buildSlaTrendSeries([], TEN_DAY_WINDOW);

  it('exposes 7, 30 and 90 day timeframes', () => {
    expect(TREND_WINDOW_DAYS).toStrictEqual({ '7d': 7, '30d': 30, '90d': 90 });
  });

  it('trims to the trailing days of the requested timeframe', () => {
    const slice = sliceTrendSeries(series, '7d');

    expect(slice).toHaveLength(7);
    expect(slice[0].date).toBe('2026-09-04');
    expect(slice[6].date).toBe('2026-09-10');
  });

  it('returns the whole series when it is shorter than the timeframe', () => {
    expect(sliceTrendSeries(series, '90d')).toHaveLength(10);
  });
});

describe('computeTrendScale', () => {
  it('zooms to the observed range rather than spanning 0-100', () => {
    const series = buildSlaTrendSeries(
      [resolvedOutage('a', '2026-09-02T00:00:00Z', 60)],
      TEN_DAY_WINDOW
    );

    const scale = computeTrendScale(series, 99.9);
    expect(scale.max).toBe(100);
    expect(scale.min).toBeGreaterThan(90);
    expect(scale.min).toBeLessThanOrEqual(95.833333);
  });

  it('keeps the target inside the domain even on a perfect series', () => {
    const scale = computeTrendScale(
      buildSlaTrendSeries([], TEN_DAY_WINDOW),
      99.9
    );

    expect(scale.min).toBeLessThan(99.9);
    expect(scale.max).toBe(100);
  });

  it('never dips below zero', () => {
    const scale = computeTrendScale(
      [
        {
          date: '2026-09-01',
          availabilityPercentage: 0,
          outageCount: 1,
          downtimeMinutes: 1440,
        },
      ],
      99.9
    );

    expect(scale.min).toBe(0);
  });
});

describe('scaleY and scaleX', () => {
  const scale = { min: 95, max: 100 };

  it('puts the domain top at y=0 and the bottom at y=height', () => {
    expect(scaleY(100, scale, 100)).toBe(0);
    expect(scaleY(95, scale, 100)).toBe(100);
  });

  it('clamps values outside the domain instead of drawing off-canvas', () => {
    expect(scaleY(110, scale, 100)).toBe(0);
    expect(scaleY(80, scale, 100)).toBe(100);
  });

  it('spreads x across the width, centring a single point', () => {
    expect(scaleX(0, 10, 100)).toBe(0);
    expect(scaleX(9, 10, 100)).toBe(100);
    expect(scaleX(0, 1, 100)).toBe(50);
  });
});

describe('trendAreaPath', () => {
  const series = buildSlaTrendSeries([], TEN_DAY_WINDOW);
  const scale = computeTrendScale(series, 99.9);

  it('closes the area down to the baseline', () => {
    const path = trendAreaPath(series, scale, 100, 50);

    expect(path.startsWith('M ')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
    expect(path).toContain('L 100 50');
  });

  it('returns an empty path for an empty series', () => {
    expect(trendAreaPath([], scale, 100, 50)).toBe('');
  });
});
