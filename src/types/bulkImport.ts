export interface ImportValidationError {
  row?: number;
  field?: string;
  message: string;
}

export interface BulkImportResult {
  imported: number;
  skipped: number;
  errors: ImportValidationError[];
}

export interface BulkImportRecord {
  id: string;
  filename: string;
  imported: number;
  skipped: number;
  error_count: number;
  errors: ImportValidationError[];
  created_at: string;
}

/**
 * Result of a validate-only bulk import (issue #637).
 *
 * Shares the shape of {@link BulkImportResult}, where `imported` and `skipped`
 * mean "would have been" rather than "was".
 */
export interface BulkImportDryRunResult extends BulkImportResult {
  /**
   * Server confirmation that the request wrote nothing.
   *
   * TODO(#637): optional until the backend confirms it emits this field on
   * /outages/bulk/validate. The UI treats `true` as a failure rather than
   * claiming zero modifications it cannot vouch for, and treats `undefined` as
   * "not reported" — it does not assume success. Migration: make this required
   * once the endpoint ships it, and drop the undefined branch.
   */
  database_modified?: boolean;
}
