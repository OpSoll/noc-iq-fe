import { describe, expect, it } from 'vitest';

import { detectDuplicateRows } from '../DuplicateDetector';

describe('detectDuplicateRows (issue #631)', () => {
  const headers = ['service_id', 'start_time', 'end_time'];

  it('returns no hits when all keys are unique', () => {
    const rows = [
      ['svc-a', '2026-01-01T00:00:00Z', '2026-01-01T01:00:00Z'],
      ['svc-b', '2026-01-01T00:00:00Z', '2026-01-01T01:00:00Z'],
    ];
    const result = detectDuplicateRows(headers, rows);
    expect(result.duplicateCount).toBe(0);
    expect(result.hits).toHaveLength(0);
    expect(result.excludedRowIndexes.size).toBe(0);
  });

  it('flags later rows with the same service_id + start_time', () => {
    const rows = [
      ['svc-a', '2026-01-01T00:00:00Z', '2026-01-01T01:00:00Z'],
      ['svc-a', '2026-01-01T00:00:00Z', '2026-01-01T02:00:00Z'], // dup
      ['svc-a', '2026-01-02T00:00:00Z', '2026-01-02T01:00:00Z'],
    ];
    const result = detectDuplicateRows(headers, rows);
    expect(result.duplicateCount).toBe(1);
    expect(result.hits[0].rowIndex).toBe(1);
    expect(result.hits[0].sheetRow).toBe(3);
    expect(result.excludedRowIndexes.has(1)).toBe(true);
    expect(result.excludedRowIndexes.has(0)).toBe(false);
  });

  it('uses site_id when service_id is absent', () => {
    const siteHeaders = ['site_id', 'start_time', 'end_time'];
    const rows = [
      ['site-1', '2026-03-01T12:00:00Z', '2026-03-01T13:00:00Z'],
      ['site-1', '2026-03-01T12:00:00Z', '2026-03-01T14:00:00Z'],
    ];
    const result = detectDuplicateRows(siteHeaders, rows);
    expect(result.duplicateCount).toBe(1);
    expect(result.duplicateKeys).toEqual(['site-1|2026-03-01T12:00:00Z']);
  });

  it('returns empty result when identity columns are missing', () => {
    const result = detectDuplicateRows(['foo', 'bar'], [['a', 'b']]);
    expect(result.duplicateCount).toBe(0);
  });
});
