import type {
  BulkImportResult,
  ImportValidationError,
} from '@/types/bulkImport';

/**
 * Import summary derivation and error-log export for the bulk import
 * completion modal (closes #632).
 *
 * Both the modal and the handful of places that render a per-row error list
 * read from here, so the breakdown a user sees and the CSV they download are
 * derived from the same `BulkImportResult` and can never disagree.
 */

export interface ImportSummary {
  /** Rows the server committed. */
  imported: number;
  /**
   * Rows the server set aside as duplicates. The API calls this `skipped`;
   * the modal surfaces it as "Skipped Duplicates" because duplicate detection
   * is the only reason the importer skips a row.
   */
  skippedDuplicates: number;
  /** Rows rejected, i.e. the number of entries in `errors`. */
  failed: number;
  /** Every row accounted for: imported + skipped + failed. */
  total: number;
  hasFailures: boolean;
}

/** Columns written to the downloadable error log, in order. */
export const ERROR_LOG_HEADERS = ['row', 'field', 'message'] as const;

/**
 * Coerces a server count to a non-negative integer. Counts arriving as
 * undefined, negative or fractional must not produce a nonsense breakdown such
 * as "-1 imported".
 */
function safeCount(value: number | undefined | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

/** Derives the three-way breakdown shown in the completion modal. */
export function buildImportSummary(result: BulkImportResult): ImportSummary {
  const imported = safeCount(result.imported);
  const skippedDuplicates = safeCount(result.skipped);
  const failed = Array.isArray(result.errors) ? result.errors.length : 0;

  return {
    imported,
    skippedDuplicates,
    failed,
    total: imported + skippedDuplicates + failed,
    hasFailures: failed > 0,
  };
}

/** Escapes a single CSV cell, quoting only when the value requires it. */
function escapeCell(cell: string): string {
  if (/[",\n\r]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

/**
 * Renders the failed rows as a CSV error log.
 *
 * Cells are quoted only when they need quoting, and embedded quotes are
 * doubled — the same rule the sample template uses — so a message containing a
 * comma stays in one column instead of silently shifting the row.
 */
export function buildErrorLogCsv(errors: ImportValidationError[]): string {
  const lines = [
    ERROR_LOG_HEADERS.join(','),
    ...errors.map((error) =>
      [
        error.row != null ? String(error.row) : '',
        error.field ?? '',
        error.message ?? '',
      ]
        .map(escapeCell)
        .join(',')
    ),
  ];

  return `${lines.join('\n')}\n`;
}

/** Date-stamped filename for the error log, e.g. `import-errors-2026-09-28.csv`. */
export function errorLogFilename(now: Date = new Date()): string {
  return `import-errors-${now.toISOString().slice(0, 10)}.csv`;
}

/**
 * Triggers a browser download of the error log.
 *
 * Mirrors `downloadSampleCsv` in `SampleDownload.tsx` so both downloads behave
 * identically (object URL revoked, anchor removed).
 */
export function downloadErrorLogCsv(
  errors: ImportValidationError[],
  filename: string = errorLogFilename()
): void {
  const blob = new Blob([buildErrorLogCsv(errors)], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
