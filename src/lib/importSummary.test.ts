import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImportValidationError } from '@/types/bulkImport';
import {
  ERROR_LOG_HEADERS,
  buildErrorLogCsv,
  buildImportSummary,
  downloadErrorLogCsv,
  errorLogFilename,
} from './importSummary';

function error(
  overrides: Partial<ImportValidationError> = {}
): ImportValidationError {
  return { message: 'Invalid value', ...overrides };
}

describe('buildImportSummary', () => {
  it('breaks the result down into imported, skipped and failed', () => {
    const summary = buildImportSummary({
      imported: 12,
      skipped: 3,
      errors: [error(), error()],
    });

    expect(summary).toStrictEqual({
      imported: 12,
      skippedDuplicates: 3,
      failed: 2,
      total: 17,
      hasFailures: true,
    });
  });

  it('reports a clean import with no failures', () => {
    const summary = buildImportSummary({ imported: 5, skipped: 0, errors: [] });

    expect(summary.hasFailures).toBe(false);
    expect(summary.failed).toBe(0);
    expect(summary.total).toBe(5);
  });

  it('accounts for every row in the total', () => {
    const summary = buildImportSummary({
      imported: 7,
      skipped: 4,
      errors: [error(), error(), error()],
    });

    expect(summary.total).toBe(7 + 4 + 3);
  });

  it('treats a fully skipped import as having no failures', () => {
    const summary = buildImportSummary({ imported: 0, skipped: 9, errors: [] });

    expect(summary.hasFailures).toBe(false);
    expect(summary.total).toBe(9);
  });

  it('never reports negative or fractional counts', () => {
    const summary = buildImportSummary({
      imported: -3,
      skipped: 2.9,
      errors: [],
    });

    expect(summary.imported).toBe(0);
    expect(summary.skippedDuplicates).toBe(2);
  });

  it('tolerates a missing error list', () => {
    const summary = buildImportSummary({
      imported: 1,
      skipped: 0,
      errors: undefined as unknown as ImportValidationError[],
    });

    expect(summary.failed).toBe(0);
    expect(summary.hasFailures).toBe(false);
  });
});

describe('buildErrorLogCsv', () => {
  it('writes the documented header row', () => {
    expect(ERROR_LOG_HEADERS).toStrictEqual(['row', 'field', 'message']);
    expect(buildErrorLogCsv([])).toBe('row,field,message\n');
  });

  it('writes one line per failed row', () => {
    const csv = buildErrorLogCsv([
      error({ row: 4, field: 'start_time', message: 'Invalid date' }),
      error({ row: 9, field: 'severity', message: 'Unknown severity' }),
    ]);

    expect(csv).toBe(
      'row,field,message\n' +
        '4,start_time,Invalid date\n' +
        '9,severity,Unknown severity\n'
    );
  });

  it('quotes a message containing a comma so the row keeps its shape', () => {
    const csv = buildErrorLogCsv([
      error({ row: 2, field: 'end_time', message: 'Got "a,b", expected ISO' }),
    ]);

    expect(csv).toContain('2,end_time,"Got ""a,b"", expected ISO"\n');
  });

  it('leaves absent row and field cells empty', () => {
    const csv = buildErrorLogCsv([error({ message: 'File is empty' })]);

    expect(csv).toBe('row,field,message\n,,File is empty\n');
  });

  it('escapes a newline inside a message', () => {
    const csv = buildErrorLogCsv([error({ message: 'line one\nline two' })]);

    expect(csv).toBe('row,field,message\n,,"line one\nline two"\n');
  });
});

describe('errorLogFilename', () => {
  it('stamps the UTC date', () => {
    expect(errorLogFilename(new Date('2026-09-28T15:04:05Z'))).toBe(
      'import-errors-2026-09-28.csv'
    );
  });
});

describe('downloadErrorLogCsv', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let click: ReturnType<typeof vi.spyOn>;
  let downloadedFilename: string | null;

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:error-log');
    revokeObjectURL = vi.fn();
    downloadedFilename = null;
    URL.createObjectURL =
      createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL =
      revokeObjectURL as unknown as typeof URL.revokeObjectURL;
    click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function captureFilename(this: HTMLAnchorElement) {
        downloadedFilename = this.download;
      });
  });

  afterEach(() => {
    click.mockRestore();
  });

  it('downloads the error log and cleans up the object URL', () => {
    downloadErrorLogCsv([error({ row: 3, message: 'Bad row' })]);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:error-log');
  });

  it('names the file with the date stamp by default', () => {
    downloadErrorLogCsv(
      [error()],
      errorLogFilename(new Date('2026-09-28T00:00:00Z'))
    );

    expect(downloadedFilename).toBe('import-errors-2026-09-28.csv');
  });

  it('honours an explicit filename', () => {
    downloadErrorLogCsv([], 'custom.csv');

    expect(downloadedFilename).toBe('custom.csv');
  });

  it('leaves no anchor behind in the document', () => {
    downloadErrorLogCsv([error()]);

    expect(document.body.querySelectorAll('a')).toHaveLength(0);
  });
});
