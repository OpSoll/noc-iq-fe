import { describe, expect, it } from 'vitest';

import {
  applyCellEdit,
  isRowValid,
  revalidateCell,
} from '../ValidationPreview';
import type { ImportValidationError } from '@/types/bulkImport';

describe('inline cell edit + re-validation (issue #628)', () => {
  const headers = ['service_id', 'start_time', 'end_time'];
  const rows = [
    ['svc-a', 'not-a-date', '2026-01-01T02:00:00Z'],
    ['svc-b', '2026-01-02T00:00:00Z', '2026-01-02T01:00:00Z'],
  ];

  it('revalidateCell flags invalid date', () => {
    const errs = revalidateCell(headers, rows, 0, 'start_time', 'not-a-date');
    expect(errs.some((e) => e.field === 'start_time')).toBe(true);
  });

  it('revalidateCell accepts valid ISO date', () => {
    const errs = revalidateCell(
      headers,
      rows,
      0,
      'start_time',
      '2026-01-01T00:00:00Z'
    );
    expect(errs.filter((e) => e.field === 'start_time')).toHaveLength(0);
  });

  it('applyCellEdit updates value and clears field errors when fixed', () => {
    const initialErrors: ImportValidationError[] = [
      {
        row: 2,
        field: 'start_time',
        message: 'Invalid date format for "start_time"',
      },
    ];
    expect(isRowValid(initialErrors, 0)).toBe(false);

    const { rows: nextRows, errors: nextErrors } = applyCellEdit(
      headers,
      rows,
      initialErrors,
      0,
      'start_time',
      '2026-01-01T00:00:00Z'
    );

    expect(nextRows[0][1]).toBe('2026-01-01T00:00:00Z');
    expect(isRowValid(nextErrors, 0)).toBe(true);
  });

  it('applyCellEdit marks row invalid again if required field cleared', () => {
    const { errors } = applyCellEdit(headers, rows, [], 1, 'service_id', '');
    expect(isRowValid(errors, 1)).toBe(false);
    expect(errors.some((e) => e.field === 'service_id')).toBe(true);
  });
});
