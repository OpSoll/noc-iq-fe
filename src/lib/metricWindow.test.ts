import { describe, it, expect } from 'vitest';

import type { Outage } from '@/types/outages';
import {
  DEFAULT_WINDOW_DAYS,
  filterOutagesByDetectedAt,
  formatWindowLabel,
  isWithinWindow,
  resolveMetricWindow,
  resolvePreviousWindow,
  toIsoDay,
} from './metricWindow';

const NOW = new Date('2026-09-28T12:00:00Z');
const DAY_MS = 86_400_000;

function makeOutage(overrides: Partial<Outage> = {}): Outage {
  return {
    id: overrides.id ?? 'o1',
    site_name: 'Site A',
    severity: 'high',
    status: 'resolved',
    detected_at: '2026-09-15T00:00:00Z',
    description: 'test',
    affected_services: [],
    ...overrides,
  };
}

describe('resolveMetricWindow', () => {
  it('uses an explicit range with an exclusive upper bound of the following midnight', () => {
    const window = resolveMetricWindow('2026-09-01', '2026-09-10', NOW);

    expect(window.from.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(window.to.toISOString()).toBe('2026-09-11T00:00:00.000Z');
  });

  it('runs from the lower bound up to now when only a start is given', () => {
    const window = resolveMetricWindow('2026-09-01', undefined, NOW);

    expect(window.from.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(window.to).toBe(NOW);
  });

  it('looks back the default number of days when only an end is given', () => {
    const window = resolveMetricWindow(undefined, '2026-09-10', NOW);
    const end = new Date('2026-09-11T00:00:00.000Z');

    expect(window.to.getTime()).toBe(end.getTime());
    expect(window.from.getTime()).toBe(
      end.getTime() - DEFAULT_WINDOW_DAYS * DAY_MS
    );
  });

  it('defaults to the trailing window when no filter is applied', () => {
    const window = resolveMetricWindow(undefined, undefined, NOW);

    expect(window.to).toBe(NOW);
    expect(window.from.getTime()).toBe(
      NOW.getTime() - DEFAULT_WINDOW_DAYS * DAY_MS
    );
  });

  it('falls back to the default window for unparseable filter values', () => {
    const window = resolveMetricWindow('not-a-date', 'also-not', NOW);

    expect(window.to).toBe(NOW);
    expect(window.from.getTime()).toBe(
      NOW.getTime() - DEFAULT_WINDOW_DAYS * DAY_MS
    );
  });

  it('describes a single-day filter as a full day, not a zero-length window', () => {
    const window = resolveMetricWindow('2026-09-10', '2026-09-10', NOW);

    expect(window.to.getTime()).toBeGreaterThan(window.from.getTime());
    expect(window.to.getTime() - window.from.getTime()).toBe(DAY_MS);
  });
});

describe('resolvePreviousWindow', () => {
  it('returns the immediately preceding period of equal length', () => {
    const window = resolveMetricWindow('2026-09-01', '2026-09-10', NOW);
    const previous = resolvePreviousWindow(window);

    expect(previous.to.getTime()).toBe(window.from.getTime());
    expect(previous.to.getTime() - previous.from.getTime()).toBe(
      window.to.getTime() - window.from.getTime()
    );
  });

  it('tiles exactly against the current window with no gap or overlap', () => {
    const window = resolveMetricWindow('2026-09-01', '2026-09-10', NOW);
    const previous = resolvePreviousWindow(window);

    expect(previous.to.getTime()).toBe(window.from.getTime());
    expect(previous.from.getTime()).toBe(window.from.getTime() - 10 * DAY_MS);
  });
});

describe('isWithinWindow', () => {
  const window = {
    from: new Date('2026-09-01T00:00:00Z'),
    to: new Date('2026-09-10T00:00:00Z'),
  };

  it('includes the lower bound and excludes the upper bound', () => {
    expect(isWithinWindow('2026-09-01T00:00:00Z', window)).toBe(true);
    expect(isWithinWindow('2026-09-09T23:59:59Z', window)).toBe(true);
    expect(isWithinWindow('2026-09-10T00:00:00Z', window)).toBe(false);
  });

  it('rejects timestamps before the window', () => {
    expect(isWithinWindow('2026-08-31T23:59:59Z', window)).toBe(false);
  });

  it('rejects missing and unparseable timestamps', () => {
    expect(isWithinWindow(undefined, window)).toBe(false);
    expect(isWithinWindow('not-a-date', window)).toBe(false);
  });
});

describe('filterOutagesByDetectedAt', () => {
  const window = {
    from: new Date('2026-09-01T00:00:00Z'),
    to: new Date('2026-09-10T00:00:00Z'),
  };

  it('keeps only outages detected inside the window', () => {
    const outages = [
      makeOutage({ id: 'in', detected_at: '2026-09-05T00:00:00Z' }),
      makeOutage({ id: 'before', detected_at: '2026-08-05T00:00:00Z' }),
      makeOutage({ id: 'after', detected_at: '2026-09-20T00:00:00Z' }),
    ];

    expect(filterOutagesByDetectedAt(outages, window).map((o) => o.id)).toEqual(
      ['in']
    );
  });

  it('returns an empty array when nothing falls inside the window', () => {
    expect(filterOutagesByDetectedAt([], window)).toEqual([]);
  });
});

describe('formatWindowLabel', () => {
  it('renders an ISO day range', () => {
    const window = resolveMetricWindow('2026-09-01', '2026-09-10', NOW);
    expect(formatWindowLabel(window)).toBe('2026-09-01 → 2026-09-10');
  });
});

describe('toIsoDay', () => {
  it('returns the calendar day of a timestamp', () => {
    expect(toIsoDay(new Date('2026-09-28T12:00:00Z'))).toBe('2026-09-28');
  });

  it('degrades to "unknown" for an invalid date instead of throwing', () => {
    expect(toIsoDay(new Date('nonsense'))).toBe('unknown');
  });
});
