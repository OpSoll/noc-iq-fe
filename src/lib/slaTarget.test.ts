import { describe, it, expect } from 'vitest';
// Closes #449: unit tests for the SLA compliance target/threshold helpers.

import {
  DEFAULT_SLA_COMPLIANCE_TARGET,
  formatComplianceVariance,
  getComplianceVariance,
  isAboveTarget,
} from '@/lib/slaTarget';

describe('getComplianceVariance', () => {
  it('returns a positive variance when above the target', () => {
    expect(getComplianceVariance(99.95, 99.9)).toBeCloseTo(0.05, 5);
  });

  it('returns a negative variance when below the target', () => {
    expect(getComplianceVariance(97.5, 99.9)).toBeCloseTo(-2.4, 5);
  });

  it('defaults to DEFAULT_SLA_COMPLIANCE_TARGET when no target is given', () => {
    expect(getComplianceVariance(DEFAULT_SLA_COMPLIANCE_TARGET)).toBe(0);
  });
});

describe('isAboveTarget', () => {
  it('treats a value exactly at target as above (compliant)', () => {
    expect(isAboveTarget(99.9, 99.9)).toBe(true);
  });

  it('flags a value below target as not above', () => {
    expect(isAboveTarget(90, 99.9)).toBe(false);
  });
});

describe('formatComplianceVariance', () => {
  it('prefixes a positive variance with +', () => {
    expect(formatComplianceVariance(100, 99.9)).toBe('+0.1pp vs 99.9% target');
  });

  it('keeps the minus sign for a negative variance', () => {
    expect(formatComplianceVariance(95, 99.9)).toBe('-4.9pp vs 99.9% target');
  });
});
