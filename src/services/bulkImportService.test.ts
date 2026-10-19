import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildImportErrorsCSV,
  defaultImportErrorsFilename,
  downloadImportErrorsCSV,
} from './bulkImportService';

/**
 * #1009 — Bulk Import: download-errors action for failed validation rows.
 */
describe('buildImportErrorsCSV (#1009)', () => {
  it('starts with the row/field/message header', () => {
    const csv = buildImportErrorsCSV([]);
    expect(csv).toBe('"row","field","message"');
  });

  it('renders one quoted line per error', () => {
    const csv = buildImportErrorsCSV([
      { row: 3, field: 'start_time', message: 'Invalid date format' },
      { row: 5, field: 'end_time', message: 'End time must be after start time' },
    ]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('"3","start_time","Invalid date format"');
    expect(lines[2]).toBe(
      '"5","end_time","End time must be after start time"'
    );
  });

  it('leaves the row blank for file-level errors with no row number', () => {
    const csv = buildImportErrorsCSV([
      { message: 'Missing required columns: service_id' },
    ]);
    expect(csv.split('\n')[1]).toBe(
      '"","","Missing required columns: service_id"'
    );
  });

  it('escapes embedded quotes so the CSV stays well-formed', () => {
    const csv = buildImportErrorsCSV([
      { row: 2, field: 'site', message: 'Value "unknown" is not allowed' },
    ]);
    expect(csv).toContain('"Value ""unknown"" is not allowed"');
  });

  it('preserves commas and newlines inside a cell', () => {
    const csv = buildImportErrorsCSV([
      { row: 7, message: 'a,b\nc' },
    ]);
    expect(csv).toContain('"a,b\nc"');
  });
});

describe('defaultImportErrorsFilename (#1009)', () => {
  it('stamps the filename with the ISO date', () => {
    expect(defaultImportErrorsFilename(new Date('2026-10-19T12:00:00Z'))).toBe(
      'bulk-import-errors-2026-10-19.csv'
    );
  });
});

describe('downloadImportErrorsCSV (#1009)', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:mock-url');
    revokeObjectURL = vi.fn();
    // jsdom does not implement these.
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates and clicks an anchor with a CSV blob', () => {
    downloadImportErrorsCSV([{ row: 3, message: 'boom' }]);

    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toContain('text/csv');

    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('does not leave the temporary anchor in the document', () => {
    downloadImportErrorsCSV([{ row: 1, message: 'boom' }]);
    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
  });

  it('uses the supplied filename', () => {
    const spy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('custom.csv');
      });
    downloadImportErrorsCSV([], 'custom.csv');
    expect(spy).toHaveBeenCalled();
  });
});
