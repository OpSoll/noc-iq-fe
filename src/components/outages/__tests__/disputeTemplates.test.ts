import { describe, it, expect } from 'vitest';

import {
  RESOLUTION_TEMPLATES,
  getResolutionTemplate,
} from '../disputeTemplates';

describe('resolution templates (opsoll/noc-iq-fe#494)', () => {
  it('offers exactly the three required templates', () => {
    expect(RESOLUTION_TEMPLATES.map((t) => t.label)).toEqual([
      'SLA Calculation Error Accepted',
      'Maintenance Window Exclusion',
      'Dispute Rejected - Invalid Evidence',
    ]);
  });

  it('every template populates a non-empty resolution note', () => {
    for (const template of RESOLUTION_TEMPLATES) {
      expect(template.note.trim().length).toBeGreaterThan(20);
      expect(template.note).not.toMatch(/^\s*$/);
    }
  });

  it('resolves a template by id', () => {
    const template = getResolutionTemplate('maintenance-window-exclusion');
    expect(template?.label).toBe('Maintenance Window Exclusion');
    expect(template?.note).toMatch(/maintenance window/i);
  });

  it('returns null for unknown template ids', () => {
    expect(getResolutionTemplate('does-not-exist')).toBeNull();
    expect(getResolutionTemplate('')).toBeNull();
  });

  it('template ids are unique', () => {
    const ids = RESOLUTION_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
