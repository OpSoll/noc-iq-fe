import { describe, it, expect } from 'vitest';

import type { Outage } from '@/types/outages';
import {
  AVAILABILITY_NO_DATA,
  AVAILABILITY_PRECISION,
  computeAvailability,
  formatAvailability,
} from './slaAvailability';

/** A 10 hour window: 2026-09-01T00:00Z → 2026-09-01T10:00Z (600 minutes). */
const WINDOW = {
  from: new Date('2026-09-01T00:00:00Z'),
  to: new Date('2026-09-01T10:00:00Z'),
};

const WINDOW_MINUTES = 600;

function makeOutage(overrides: Partial<Outage> = {}): Outage {
  return {
    id: overrides.id ?? 'o1',
    site_name: 'Site A',
    severity: 'high',
    status: overrides.status ?? 'resolved',
    detected_at: overrides.detected_at ?? '2026-09-01T01:00:00Z',
    resolved_at: overrides.resolved_at ?? '2026-09-01T02:00:00Z',
    description: 'test',
    affected_services: [],
    ...overrides,
  };
}

describe('computeAvailability', () => {
  it('reports 100% when no outage overlaps the window', () => {
    const result = computeAvailability([], WINDOW);

    expect(result.percentage).toBe(100);
    expect(result.downtimeMinutes).toBe(0);
    expect(result.windowMinutes).toBe(WINDOW_MINUTES);
    expect(result.affectedOutageCount).toBe(0);
  });

  it('subtracts a fully enclosed outage from the window', () => {
    const result = computeAvailability(
      [
        makeOutage({
          detected_at: '2026-09-01T01:00:00Z',
          resolved_at: '2026-09-01T02:00:00Z',
        }),
      ],
      WINDOW
    );

    expect(result.downtimeMinutes).toBe(60);
    expect(result.percentage).toBeCloseTo(90, 10);
    expect(result.affectedOutageCount).toBe(1);
  });

  it('clips an outage that started before the window', () => {
    const result = computeAvailability(
      [
        makeOutage({
          detected_at: '2026-08-31T20:00:00Z',
          resolved_at: '2026-09-01T01:00:00Z',
        }),
      ],
      WINDOW
    );

    // Only the hour inside the window counts as downtime.
    expect(result.downtimeMinutes).toBe(60);
  });

  it('clips an outage that resolves after the window', () => {
    const result = computeAvailability(
      [
        makeOutage({
          detected_at: '2026-09-01T09:30:00Z',
          resolved_at: '2026-09-01T12:00:00Z',
        }),
      ],
      WINDOW
    );

    expect(result.downtimeMinutes).toBe(30);
  });

  it('runs an unresolved outage to the end of the window', () => {
    const result = computeAvailability(
      [
        makeOutage({
          status: 'open',
          detected_at: '2026-09-01T09:00:00Z',
          resolved_at: undefined,
        }),
      ],
      WINDOW
    );

    expect(result.downtimeMinutes).toBe(60);
    expect(result.percentage).toBeCloseTo(90, 10);
  });

  it('merges overlapping outages so downtime is never double counted', () => {
    const result = computeAvailability(
      [
        makeOutage({
          id: 'a',
          detected_at: '2026-09-01T01:00:00Z',
          resolved_at: '2026-09-01T03:00:00Z',
        }),
        makeOutage({
          id: 'b',
          detected_at: '2026-09-01T02:00:00Z',
          resolved_at: '2026-09-01T04:00:00Z',
        }),
      ],
      WINDOW
    );

    // 01:00-04:00 = 180 minutes, not 120 + 120.
    expect(result.downtimeMinutes).toBe(180);
    expect(result.affectedOutageCount).toBe(2);
  });

  it('sums disjoint outages', () => {
    const result = computeAvailability(
      [
        makeOutage({
          id: 'a',
          detected_at: '2026-09-01T01:00:00Z',
          resolved_at: '2026-09-01T02:00:00Z',
        }),
        makeOutage({
          id: 'b',
          detected_at: '2026-09-01T05:00:00Z',
          resolved_at: '2026-09-01T05:30:00Z',
        }),
      ],
      WINDOW
    );

    expect(result.downtimeMinutes).toBe(90);
  });

  it('never reports negative availability when downtime covers the window', () => {
    const result = computeAvailability(
      [
        makeOutage({
          status: 'open',
          detected_at: '2026-09-01T00:00:00Z',
          resolved_at: undefined,
        }),
      ],
      WINDOW
    );

    expect(result.downtimeMinutes).toBe(WINDOW_MINUTES);
    expect(result.percentage).toBe(0);
  });

  it('ignores outages detected outside the window', () => {
    const result = computeAvailability(
      [
        makeOutage({
          id: 'before',
          detected_at: '2026-08-20T00:00:00Z',
          resolved_at: '2026-08-20T05:00:00Z',
        }),
        makeOutage({
          id: 'after',
          detected_at: '2026-09-20T00:00:00Z',
          resolved_at: '2026-09-20T05:00:00Z',
        }),
      ],
      WINDOW
    );

    expect(result.downtimeMinutes).toBe(0);
    expect(result.affectedOutageCount).toBe(0);
  });

  it('ignores an outage that resolves before it is detected', () => {
    const result = computeAvailability(
      [
        makeOutage({
          detected_at: '2026-09-01T02:00:00Z',
          resolved_at: '2026-09-01T01:00:00Z',
        }),
      ],
      WINDOW
    );

    expect(result.downtimeMinutes).toBe(0);
    expect(result.affectedOutageCount).toBe(0);
  });

  it('ignores an unparseable detected_at', () => {
    const result = computeAvailability(
      [makeOutage({ detected_at: 'not-a-date' })],
      WINDOW
    );

    expect(result.downtimeMinutes).toBe(0);
    expect(result.affectedOutageCount).toBe(0);
  });

  it('returns no percentage for an empty window', () => {
    const result = computeAvailability([], {
      from: new Date('2026-09-01T00:00:00Z'),
      to: new Date('2026-09-01T00:00:00Z'),
    });

    expect(result.percentage).toBeNull();
    expect(result.windowMinutes).toBe(0);
  });

  it('returns no percentage for an inverted window', () => {
    const result = computeAvailability([], {
      from: new Date('2026-09-01T10:00:00Z'),
      to: new Date('2026-09-01T00:00:00Z'),
    });

    expect(result.percentage).toBeNull();
  });
});

describe('formatAvailability', () => {
  it('renders exactly three decimal places', () => {
    expect(AVAILABILITY_PRECISION).toBe(3);
    expect(formatAvailability(100)).toBe('100.000%');
    expect(formatAvailability(99.9)).toBe('99.900%');
    expect(formatAvailability(99.98241)).toBe('99.982%');
  });

  it('pads a whole number so the precision is always visible', () => {
    expect(formatAvailability(98)).toBe('98.000%');
  });

  it('renders the no-data placeholder for null and non-finite input', () => {
    expect(formatAvailability(null)).toBe(AVAILABILITY_NO_DATA);
    expect(formatAvailability(Number.NaN)).toBe(AVAILABILITY_NO_DATA);
    expect(formatAvailability(Number.POSITIVE_INFINITY)).toBe(
      AVAILABILITY_NO_DATA
    );
  });

  it('matches the value the widget renders for a known 6 second outage', () => {
    const result = computeAvailability(
      [
        makeOutage({
          detected_at: '2026-09-01T01:00:00Z',
          resolved_at: '2026-09-01T01:00:06Z',
        }),
      ],
      WINDOW
    );

    expect(formatAvailability(result.percentage)).toBe('99.983%');
  });
});
