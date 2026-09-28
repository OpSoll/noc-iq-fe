'use client';

/**
 * Import History drawer (#635) — past bulk import jobs with error log download
 * and re-run for failed batches.
 */

import { useMemo } from 'react';
import Modal from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { BulkImportRecord, ImportValidationError } from '@/types/bulkImport';

export type ImportJobStatus = 'success' | 'partial' | 'failed' | 'running';

export interface ImportHistoryJob extends BulkImportRecord {
  status: ImportJobStatus;
  /** Optional original file blob/text for re-run. */
  sourceCsv?: string;
}

export interface ImportHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: ImportHistoryJob[];
  onRerun?: (job: ImportHistoryJob) => void;
}

function deriveStatus(job: BulkImportRecord): ImportJobStatus {
  if (job.error_count > 0 && job.imported === 0) return 'failed';
  if (job.error_count > 0) return 'partial';
  return 'success';
}

function statusVariant(
  status: ImportJobStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'failed':
      return 'destructive';
    case 'partial':
      return 'outline';
    case 'running':
      return 'secondary';
    default:
      return 'default';
  }
}

function formatErrorLog(errors: ImportValidationError[]): string {
  if (!errors.length) return 'No errors recorded.\n';
  return errors
    .map((e) => {
      const row = e.row != null ? `row ${e.row}` : 'row ?';
      const field = e.field ? ` field=${e.field}` : '';
      return `${row}${field}: ${e.message}`;
    })
    .join('\n');
}

export function downloadErrorLog(job: ImportHistoryJob): void {
  const body = [
    `# Import error log`,
    `# file: ${job.filename}`,
    `# date: ${job.created_at}`,
    `# imported: ${job.imported}  skipped: ${job.skipped}  errors: ${job.error_count}`,
    '',
    formatErrorLog(job.errors ?? []),
  ].join('\n');

  const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `import-errors-${job.id}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportHistoryDrawer({
  isOpen,
  onClose,
  jobs,
  onRerun,
}: ImportHistoryDrawerProps) {
  const sorted = useMemo(
    () =>
      [...jobs].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [jobs],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import History"
      maxWidth="max-w-3xl"
    >
      <div className="max-h-[70vh] overflow-y-auto" data-testid="import-history-drawer">
        {sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No past import jobs yet.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-background text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">File</th>
                <th className="px-2 py-2">Rows</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((job) => {
                const status = job.status ?? deriveStatus(job);
                return (
                  <tr key={job.id} className="border-t border-border">
                    <td className="px-2 py-2 whitespace-nowrap">
                      {new Date(job.created_at).toLocaleString()}
                    </td>
                    <td className="px-2 py-2 font-medium">{job.filename}</td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {job.imported} ok / {job.skipped} skip / {job.error_count}{' '}
                      err
                    </td>
                    <td className="px-2 py-2">
                      <Badge variant={statusVariant(status)}>{status}</Badge>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => downloadErrorLog(job)}
                          disabled={!job.errors?.length && job.error_count === 0}
                        >
                          Error log
                        </Button>
                        {(status === 'failed' || status === 'partial') &&
                          onRerun && (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => onRerun(job)}
                            >
                              Re-run
                            </Button>
                          )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  );
}

export default ImportHistoryDrawer;
