import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ComponentProps } from 'react';

import {
  ValidationPreview,
  buildValidationRows,
  computeVisibleRows,
} from './ValidationPreview';
import type { ImportValidationError } from '@/types/bulkImport';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const HEADERS = ['service_id', 'start_time', 'end_time'];

const RECORDS = [
  ['api', '2026-01-01', '2026-01-02'],
  ['web', 'nope', '2026-01-04'],
  ['db', '2026-01-03', '2026-01-05'],
];

const ERRORS: ImportValidationError[] = [
  { row: 3, field: 'start_time', message: 'Invalid date format' },
  { message: 'Missing required columns: end_time' },
];

// ─── buildValidationRows ─────────────────────────────────────────────────────

describe('buildValidationRows', () => {
  it('numbers records from line 2 because line 1 is the header', () => {
    const rows = buildValidationRows(RECORDS, []);

    expect(rows.map((row) => row.line)).toEqual([2, 3, 4]);
    expect(rows[0].cells).toEqual(RECORDS[0]);
  });

  it('attaches the errors that reference the same line', () => {
    const rows = buildValidationRows(RECORDS, ERRORS);

    expect(rows[0].errors).toEqual([]);
    expect(rows[1].errors).toEqual([ERRORS[0]]);
    expect(rows[2].errors).toEqual([]);
  });

  it('ignores file level errors that have no line', () => {
    const rows = buildValidationRows(RECORDS, ERRORS);

    expect(rows.flatMap((row) => row.errors)).toEqual([ERRORS[0]]);
  });

  it('keeps every error reported for one line', () => {
    const rows = buildValidationRows([['api', '', '2026-01-02']], [
      { row: 2, field: 'start_time', message: 'Required field is empty' },
      { row: 2, message: 'Column count mismatch' },
    ]);

    expect(rows[0].errors).toHaveLength(2);
  });

  it('returns nothing for an empty file', () => {
    expect(buildValidationRows([], ERRORS)).toEqual([]);
  });
});

// ─── computeVisibleRows ──────────────────────────────────────────────────────

describe('computeVisibleRows', () => {
  const rows = buildValidationRows(RECORDS, ERRORS);

  it('keeps every row when the filter is off', () => {
    expect(computeVisibleRows(rows, false)).toHaveLength(3);
  });

  it('keeps only the rows with errors when the filter is on', () => {
    const visible = computeVisibleRows(rows, true);

    expect(visible.map((row) => row.line)).toEqual([3]);
  });
});

// ─── ValidationPreview ───────────────────────────────────────────────────────

type PreviewProps = ComponentProps<typeof ValidationPreview>;

function setup(overrides: Partial<PreviewProps> = {}) {
  const props: PreviewProps = {
    headers: HEADERS,
    records: RECORDS,
    errors: ERRORS,
    totalRows: RECORDS.length,
  };

  return render(<ValidationPreview {...props} {...overrides} />);
}

describe('ValidationPreview', () => {
  it('renders a row per record with its file line number', () => {
    setup();

    expect(screen.getByRole('columnheader', { name: /^Row/ })).toBeVisible();
    expect(
      screen.getByRole('columnheader', { name: /service_id/ })
    ).toBeVisible();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('marks required columns with an asterisk', () => {
    setup({ requiredFields: ['service_id', 'start_time'] });

    const required = screen.getByRole('columnheader', {
      name: /service_id/,
    });
    const optional = screen.getByRole('columnheader', { name: /end_time/ });

    expect(required).toHaveTextContent('service_id*');
    expect(optional).not.toHaveTextContent('*');
  });

  it('summarises how many rows need attention', () => {
    setup();

    expect(screen.getByText('1 of 3 rows need attention')).toBeInTheDocument();
  });

  it('hides the row errors until the row is expanded', () => {
    setup();

    expect(screen.queryByText('Invalid date format')).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', {
      name: /show errors for row 3/i,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    expect(
      screen.getByRole('button', { name: /hide errors for row 3/i })
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Invalid date format')).toBeInTheDocument();
    expect(screen.getByText('[start_time]')).toBeInTheDocument();
  });

  it('only offers a toggle on the rows that have errors', () => {
    setup();

    expect(
      screen.queryByRole('button', { name: /errors for row 2/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /errors for row/i })
    ).toHaveLength(1);
  });

  it('collapses an expanded row again', () => {
    setup();
    const toggle = screen.getByRole('button', {
      name: /show errors for row 3/i,
    });
    fireEvent.click(toggle);
    expect(screen.getByText('Invalid date format')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /hide errors for row 3/i })
    );

    expect(screen.queryByText('Invalid date format')).not.toBeInTheDocument();
  });

  it('filters the table down to the invalid rows', () => {
    setup();

    fireEvent.click(
      screen.getByRole('checkbox', { name: /show only errors/i })
    );

    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('cannot be filtered when every row is valid', () => {
    setup({ errors: [] });

    expect(
      screen.getByRole('checkbox', { name: /show only errors/i })
    ).toBeDisabled();
    expect(screen.queryByText(/need attention/)).not.toBeInTheDocument();
  });

  it('explains an empty table instead of rendering a blank row', () => {
    setup({ records: [], totalRows: 0 });

    expect(screen.getByText('No rows to show.')).toBeInTheDocument();
  });

  it('reports the truncated row count in the footer', () => {
    setup({ totalRows: 1200 });

    expect(screen.getByText('Showing 3 of 1200 rows')).toBeInTheDocument();
  });

  it('uses a singular row label for a single record', () => {
    setup({
      records: [['api', '2026-01-01', '2026-01-02']],
      totalRows: 1,
    });

    expect(screen.getByText('1 row')).toBeInTheDocument();
  });
});
