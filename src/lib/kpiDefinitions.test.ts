import { describe, expect, it } from 'vitest';

import { KPI_DEFINITIONS, getKpiDefinition } from './kpiDefinitions';

/**
 * #1017 — every KPI exposes a concise, accurate definition.
 */
describe('KPI_DEFINITIONS (#1017)', () => {
  it('defines every metric the dashboard renders', () => {
    for (const key of [
      'mttr',
      'mtbf',
      'slaCompliance',
      'totalPenalties',
      'totalRewards',
      'netBalance',
      'violationRate',
    ] as const) {
      expect(KPI_DEFINITIONS[key]).toBeTruthy();
    }
  });

  it('gives each metric a non-empty, human-readable definition', () => {
    for (const definition of Object.values(KPI_DEFINITIONS)) {
      expect(definition.length).toBeGreaterThan(20);
      expect(definition.endsWith('.')).toBe(true);
    }
  });

  it('states the computation rather than restating the label', () => {
    expect(KPI_DEFINITIONS.mttr.toLowerCase()).toContain('resolution');
    expect(KPI_DEFINITIONS.violationRate.toLowerCase()).toContain('threshold');
  });

  it('getKpiDefinition returns the definition for a known key', () => {
    expect(getKpiDefinition('mttr')).toBe(KPI_DEFINITIONS.mttr);
  });

  it('getKpiDefinition returns undefined for an unknown key', () => {
    expect(getKpiDefinition('nope')).toBeUndefined();
  });
});
