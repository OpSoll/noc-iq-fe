import { describe, it, expect } from 'vitest';

import {
  DEFAULT_GRACE_WINDOW,
  describeGraceWindowRemaining,
  getGraceWindowOption,
  GRACE_WINDOW_OPTIONS,
  isGraceWindowHours,
  isInGraceWindow,
  validateGraceWindow,
} from '@/lib/secretRotation';

describe('GRACE_WINDOW_OPTIONS', () => {
  it('offers Immediate, 1 Hour, and 24 Hours', () => {
    expect(GRACE_WINDOW_OPTIONS.map((o) => o.value)).toEqual([0, 1, 24]);
    expect(GRACE_WINDOW_OPTIONS.map((o) => o.label)).toEqual([
      'Immediate',
      '1 Hour',
      '24 Hours',
    ]);
  });

  it('explains the trade-off for each option', () => {
    for (const option of GRACE_WINDOW_OPTIONS) {
      expect(option.description.length).toBeGreaterThan(20);
    }
    expect(getGraceWindowOption(0)?.description).toMatch(/only when/i);
    expect(getGraceWindowOption(24)?.description).toMatch(/do not deploy/i);
  });

  it('defaults to the 24 hour window', () => {
    expect(DEFAULT_GRACE_WINDOW).toBe(24);
  });

  it('returns undefined for an unknown value', () => {
    expect(getGraceWindowOption(7)).toBeUndefined();
  });
});

describe('isGraceWindowHours', () => {
  it('accepts the three supported windows', () => {
    expect(isGraceWindowHours(0)).toBe(true);
    expect(isGraceWindowHours(1)).toBe(true);
    expect(isGraceWindowHours(24)).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isGraceWindowHours(2)).toBe(false);
    expect(isGraceWindowHours(48)).toBe(false);
    expect(isGraceWindowHours(-1)).toBe(false);
  });
});

describe('validateGraceWindow', () => {
  it('accepts a value in range', () => {
    expect(validateGraceWindow(0)).toBeNull();
    expect(validateGraceWindow(24)).toBeNull();
    expect(validateGraceWindow(168)).toBeNull();
  });

  it('rejects a negative or fractional value', () => {
    expect(validateGraceWindow(-1)).toMatch(/whole number/);
    expect(validateGraceWindow(1.5)).toMatch(/whole number/);
  });

  it('rejects a grace period beyond seven days', () => {
    expect(validateGraceWindow(169)).toMatch(/7 days/);
  });
});

describe('isInGraceWindow', () => {
  const future = '2999-01-01T00:00:00.000Z';
  const past = '2000-01-01T00:00:00.000Z';

  it('is active when a secondary secret exists and has not expired', () => {
    expect(
      isInGraceWindow({
        secondary_secret_preview: 'whsec_new',
        secondary_secret_expires_at: future,
      })
    ).toBe(true);
  });

  it('treats a secondary secret with no expiry as still active', () => {
    expect(
      isInGraceWindow({
        secondary_secret_preview: 'whsec_new',
        secondary_secret_expires_at: null,
      })
    ).toBe(true);
  });

  it('is inactive once the expiry has passed', () => {
    expect(
      isInGraceWindow({
        secondary_secret_preview: 'whsec_new',
        secondary_secret_expires_at: past,
      })
    ).toBe(false);
  });

  it('is inactive with no secondary secret at all', () => {
    expect(isInGraceWindow({ secondary_secret_preview: null })).toBe(false);
    expect(
      isInGraceWindow({
        secondary_secret_preview: null,
        secondary_secret_expires_at: future,
      })
    ).toBe(false);
  });

  it('is inactive for an unparseable expiry', () => {
    expect(
      isInGraceWindow({
        secondary_secret_preview: 'whsec_new',
        secondary_secret_expires_at: 'not-a-date',
      })
    ).toBe(false);
  });

  it('treats the exact expiry instant as expired', () => {
    const now = new Date('2026-01-15T10:30:00.000Z');
    expect(
      isInGraceWindow(
        {
          secondary_secret_preview: 'whsec_new',
          secondary_secret_expires_at: now.toISOString(),
        },
        now
      )
    ).toBe(false);
  });
});

describe('describeGraceWindowRemaining', () => {
  const now = new Date('2026-01-15T10:00:00.000Z');

  it('reports hours and minutes for a multi-hour window', () => {
    expect(
      describeGraceWindowRemaining('2026-01-15T12:30:00.000Z', now)
    ).toBe('2h 30m remaining');
  });

  it('reports minutes for a sub-hour window', () => {
    expect(
      describeGraceWindowRemaining('2026-01-15T10:20:00.000Z', now)
    ).toBe('20m remaining');
  });

  it('reports a sub-minute window', () => {
    expect(
      describeGraceWindowRemaining('2026-01-15T10:00:30.000Z', now)
    ).toBe('Less than a minute remaining');
  });

  it('reports an expired window', () => {
    expect(
      describeGraceWindowRemaining('2026-01-15T09:00:00.000Z', now)
    ).toBe('Grace window has ended');
  });

  it('returns null when there is no expiry', () => {
    expect(describeGraceWindowRemaining(null, now)).toBeNull();
    expect(describeGraceWindowRemaining('not-a-date', now)).toBeNull();
  });
});
