/**
 * Issue #632 — import execution summary modal.
 *
 * Shown once a bulk import finishes so the operator sees the whole outcome in
 * one place: what was imported, what was set aside as a duplicate, and what
 * failed. Failures can be downloaded as a CSV error log, and a successful
 * import offers a jump straight to the outage table.
 *
 * Navigation and dismissal are callbacks rather than internal `useRouter`
 * calls, matching `ImportProgress`/`ImportHistoryDrawer` — the owning view
 * decides where "View Imported Outages" goes, which keeps the modal testable
 * without an App Router context.
 */

'use client';

import type { ImportValidationError } from '@/types/bulkImport';
import type { ImportSummary } from '@/lib/importSummary';
import { downloadErrorLogCsv } from '@/lib/importSummary';

export interface ImportSummaryModalProps {
  summary: ImportSummary;
  /** The failed rows behind `summary.failed`, used by the error-log download. */
  errors: ImportValidationError[];
  /** Open state; when false the modal renders nothing. */
  open?: boolean;
  onClose: () => void;
  /** Navigates to the outage table. When omitted the button is not rendered. */
  onViewOutages?: () => void;
}

export function ImportSummaryModal({
  summary,
  errors,
  open = true,
  onClose,
  onViewOutages,
}: ImportSummaryModalProps) {
  if (!open) return null;

  const title = summary.hasFailures
    ? 'Import finished with errors'
    : 'Import complete';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-summary-title"
      data-testid="import-summary-modal"
    >
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h2
          id="import-summary-title"
          className="text-lg font-semibold text-gray-900"
        >
          {title}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {summary.total.toLocaleString()} row
          {summary.total === 1 ? '' : 's'} processed.
        </p>

        <dl
          className="mt-4 grid grid-cols-3 gap-3 text-center"
          data-testid="import-summary-breakdown"
        >
          <div className="rounded-lg bg-green-50 p-3">
            <dt className="text-xs text-green-700">Successfully Imported</dt>
            <dd
              className="text-2xl font-bold text-green-800"
              data-testid="import-summary-imported"
            >
              {summary.imported.toLocaleString()}
            </dd>
          </div>
          <div className="rounded-lg bg-amber-50 p-3">
            <dt className="text-xs text-amber-700">Skipped Duplicates</dt>
            <dd
              className="text-2xl font-bold text-amber-800"
              data-testid="import-summary-skipped"
            >
              {summary.skippedDuplicates.toLocaleString()}
            </dd>
          </div>
          <div className="rounded-lg bg-red-50 p-3">
            <dt className="text-xs text-red-700">Failed Rows</dt>
            <dd
              className="text-2xl font-bold text-red-800"
              data-testid="import-summary-failed"
            >
              {summary.failed.toLocaleString()}
            </dd>
          </div>
        </dl>

        {summary.hasFailures ? (
          <p className="mt-3 text-xs text-gray-500">
            {summary.failed.toLocaleString()} row
            {summary.failed === 1 ? '' : 's'} could not be imported. Download
            the error log to see the row, field and reason for each.
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => downloadErrorLogCsv(errors)}
            disabled={!summary.hasFailures}
            title={
              summary.hasFailures ? undefined : 'No failed rows to download'
            }
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
            data-testid="download-error-log"
          >
            Download Error Log CSV
          </button>

          {onViewOutages ? (
            <button
              type="button"
              onClick={onViewOutages}
              className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="view-imported-outages"
            >
              View Imported Outages
            </button>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="close-import-summary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportSummaryModal;
