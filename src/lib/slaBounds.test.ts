import { describe, expect, it } from 'vitest';

import {
  describeBounds,
  getBoundsHint,
  SLA_BOUNDS,
  validateBound,
  validateSlaConfig,
} from './slaBounds';

/**
 * #989 — numeric bounds for the SLA threshold inputs.
 */
describe('SLA_BOUNDS (#989)', () => {
  it('defines min, step and a range for every field', () => {
    for (const spec of Object.values(SLA_BOUNDS)) {
      expect(typeof spec.min).toBe('number');
      expect(typeof spec.max).toBe('number');
      expect(typeof spec.step).toBe('number');
      expect(spec.step).toBeGreaterThan(0);
      expect(spec.max).toBeGreaterThan(spec.min);
    }
  });

  it('requires at least a one-minute threshold', () => {
    expect(SLA_BOUNDS.threshold_minutes.min).toBe(1);
    expect(SLA_BOUNDS.threshold_minutes.step).toBe(1);
  });

  it('permits zero for the monetary fields', () => {
    expect(SLA_BOUNDS.reward_base.min).toBe(0);
    expect(SLA_BOUNDS.penalty_per_minute.min).toBe(0);
  });
});

describe('describeBounds / getBoundsHint (#989)', () => {
  it('describes the accepted range with its unit', () => {
    const text = describeBounds(SLA_BOUNDS.threshold_minutes);
    expect(text).toContain('1');
    expect(text).toContain('minutes');
  });

  it('produces a non-empty helper hint for every field', () => {
    for (const key of Object.keys(SLA_BOUNDS) as Array<
      keyof typeof SLA_BOUNDS
    >) {
      const hint = getBoundsHint(key);
      expect(hint.length).toBeGreaterThan(0);
      expect(hint).toMatch(/Enter/);
    }
  });

  it('names the bounds in the threshold hint', () => {
    const hint = getBoundsHint('threshold_minutes');
    expect(hint).toContain('1');
    expect(hint).toContain('43,200');
  });
});

describe('validateBound (#989)', () => {
  it('accepts values inside the range (inclusive)', () => {
    expect(validateBound('threshold_minutes', 1)).toBeNull();
    expect(validateBound('threshold_minutes', 60)).toBeNull();
    expect(validateBound('threshold_minutes', SLA_BOUNDS.threshold_minutes.max)).toBeNull();
  });

  it('rejects a value below the minimum', () => {
    expect(validateBound('threshold_minutes', 0)).toMatch(/between/);
  });

  it('rejects a value above the maximum', () => {
    expect(
      validateBound('threshold_minutes', SLA_BOUNDS.threshold_minutes.max + 1)
    ).toMatch(/between/);
  });

  it('rejects negative monetary values', () => {
    expect(validateBound('reward_base', -1)).toMatch(/between/);
    expect(validateBound('penalty_per_minute', -0.01)).toMatch(/between/);
  });

  it('rejects non-finite values', () => {
    expect(validateBound('threshold_minutes', Number.NaN)).toMatch(/number/);
    expect(validateBound('threshold_minutes', Number.POSITIVE_INFINITY)).toMatch(
      /between|number/
    );
  });
});

describe('validateSlaConfig (#989)', () => {
  it('returns no errors for a valid configuration', () => {
    expect(
      validateSlaConfig({
        threshold_minutes: 30,
        reward_base: 100,
        penalty_per_minute: 5,
      })
    ).toEqual({});
  });

  it('reports each out-of-range field independently', () => {
    const errors = validateSlaConfig({
      threshold_minutes: 0,
      reward_base: -5,
      penalty_per_minute: 5,
    });
    expect(errors.threshold_minutes).toBeTruthy();
    expect(errors.reward_base).toBeTruthy();
    expect(errors.penalty_per_minute).toBeUndefined();
  });

  it('ignores fields that are absent', () => {
    expect(validateSlaConfig({})).toEqual({});
  });
});
