/**
 * Issue #628 – Inline cell error editing in the validation preview table.
 *
 * Double-click an invalid cell to edit; on blur/Enter the value is
 * re-validated and row status flips to Valid when all errors are cleared.
 */

'use client';

import { useCallback, useMemo, useState } from 'react';

import type { ImportValidationError } from '@/types/bulkImport';

const REQUIRED_FIELDS = ['service_id', 'start_time', 'end_time'] as const;

function isValidDate(dateString: string): boolean {
  const d = new Date(dateString);
  return d instanceof Date && !isNaN(d.getTime());
}

/**
 * Re-validate a single cell and return errors for that cell only.
 * Exported for unit tests.
 */
export function revalidateCell(
  headers: string[],
  rows: string[][],
  rowIndex: number,
  field: string,
  value: string
): ImportValidationError[] {
  const errors: ImportValidationError[] = [];
  const sheetRow = rowIndex + 2;
  const trimmed = value.trim();

  if (
    (REQUIRED_FIELDS as readonly string[]).includes(field) &&
    trimmed === ''
  ) {
    errors.push({
      row: sheetRow,
      field,
      message: `Required field "${field}" is empty`,
    });
  }

  if (
    (field === 'start_time' || field === 'end_time') &&
    trimmed !== '' &&
    !isValidDate(trimmed)
  ) {
    errors.push({
      row: sheetRow,
      field,
      message: `Invalid date format for "${field}"`,
    });
  }

  // Cross-field: end after start when both present and valid
  if (field === 'start_time' || field === 'end_time') {
    const startIdx = headers.indexOf('start_time');
    const endIdx = headers.indexOf('end_time');
    if (startIdx >= 0 && endIdx >= 0) {
      const startVal =
        field === 'start_time' ? trimmed : (rows[rowIndex]?.[startIdx] ?? '');
      const endVal =
        field === 'end_time' ? trimmed : (rows[rowIndex]?.[endIdx] ?? '');
      if (
        startVal &&
        endVal &&
        isValidDate(startVal) &&
        isValidDate(endVal) &&
        new Date(startVal) >= new Date(endVal)
      ) {
        errors.push({
          row: sheetRow,
          field: 'end_time',
          message: 'End time must be after start time',
        });
      }
    }
  }

  return errors;
}

/**
 * Apply a cell edit and return updated errors for the whole table.
 * Clears previous errors for that row+field, then merges revalidation results.
 */
export function applyCellEdit(
  headers: string[],
  rows: string[][],
  errors: ImportValidationError[],
  rowIndex: number,
  field: string,
  value: string
): { rows: string[][]; errors: ImportValidationError[] } {
  const colIndex = headers.indexOf(field);
  if (colIndex < 0 || rowIndex < 0 || rowIndex >= rows.length) {
    return { rows, errors };
  }

  const nextRows = rows.map((r, i) =>
    i === rowIndex ? r.map((c, j) => (j === colIndex ? value : c)) : r
  );

  const sheetRow = rowIndex + 2;
  const retained = errors.filter(
    (e) =>
      !(
        e.row === sheetRow &&
        (e.field === field ||
          // end_time may be re-evaluated when start_time changes
          (field === 'start_time' && e.field === 'end_time'))
      )
  );

  const cellErrors = revalidateCell(headers, nextRows, rowIndex, field, value);
  return { rows: nextRows, errors: [...retained, ...cellErrors] };
}

/** Whether a data row still has any validation errors. */
export function isRowValid(
  errors: ImportValidationError[],
  rowIndex: number
): boolean {
  const sheetRow = rowIndex + 2;
  return !errors.some((e) => e.row === sheetRow);
}

export interface ValidationPreviewProps {
  headers: string[];
  rows: string[][];
  errors: ImportValidationError[];
  /** Rows marked excluded (e.g. duplicates) – shown muted */
  excludedRowIndexes?: Set<number>;
  onRowsChange: (rows: string[][]) => void;
  onErrorsChange: (errors: ImportValidationError[]) => void;
}

export function ValidationPreview({
  headers,
  rows,
  errors,
  excludedRowIndexes,
  onRowsChange,
  onErrorsChange,
}: ValidationPreviewProps) {
  const [editing, setEditing] = useState<{
    rowIndex: number;
    field: string;
  } | null>(null);
  const [draft, setDraft] = useState('');

  const getCellError = useCallback(
    (rowIndex: number, field: string) =>
      errors.find((e) => e.row === rowIndex + 2 && e.field === field)?.message,
    [errors]
  );

  const commitEdit = useCallback(() => {
    if (!editing) return;
    const { rowIndex, field } = editing;
    const result = applyCellEdit(
      headers,
      rows,
      errors,
      rowIndex,
      field,
      draft
    );
    onRowsChange(result.rows);
    onErrorsChange(result.errors);
    setEditing(null);
  }, [editing, draft, headers, rows, errors, onRowsChange, onErrorsChange]);

  const cancelEdit = useCallback(() => {
    setEditing(null);
  }, []);

  const validCount = useMemo(() => {
    let n = 0;
    for (let i = 0; i < rows.length; i++) {
      if (isRowValid(errors, i)) n += 1;
    }
    return n;
  }, [rows, errors]);

  return (
    <div className="space-y-2" data-testid="validation-preview">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {validCount} / {rows.length} rows valid
          {excludedRowIndexes && excludedRowIndexes.size > 0
            ? ` · ${excludedRowIndexes.size} excluded`
            : ''}
        </span>
        <span className="text-gray-400">
          Double-click a red cell to edit
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">
                Row
              </th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">
                Status
              </th>
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-4 py-2 text-left font-semibold text-gray-600"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((row, i) => {
              const valid = isRowValid(errors, i);
              const excluded = excludedRowIndexes?.has(i) ?? false;
              return (
                <tr
                  key={`row-${i}`}
                  className={
                    excluded
                      ? 'bg-gray-100 opacity-60'
                      : valid
                        ? ''
                        : 'bg-red-50'
                  }
                  data-testid={`preview-row-${i}`}
                  data-valid={valid ? 'true' : 'false'}
                >
                  <td className="px-4 py-2 text-gray-500">{i + 2}</td>
                  <td className="px-4 py-2">
                    {excluded ? (
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">
                        Excluded
                      </span>
                    ) : valid ? (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">
                        Valid
                      </span>
                    ) : (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800">
                        Invalid
                      </span>
                    )}
                  </td>
                  {headers.map((h, j) => {
                    const cellError = getCellError(i, h);
                    const isEditing =
                      editing?.rowIndex === i && editing?.field === h;
                    return (
                      <td
                        key={`${h}-${j}`}
                        className={`px-4 py-2 ${
                          cellError ? 'relative bg-red-100' : 'text-gray-700'
                        }`}
                        title={cellError}
                        onDoubleClick={() => {
                          if (excluded) return;
                          setEditing({ rowIndex: i, field: h });
                          setDraft(row[j] ?? '');
                        }}
                        data-testid={`cell-${i}-${h}`}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            className="w-full rounded border border-blue-400 px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                commitEdit();
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelEdit();
                              }
                            }}
                            data-testid={`cell-editor-${i}-${h}`}
                          />
                        ) : (
                          <>
                            {cellError && (
                              <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
                            )}
                            {row[j]}
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ValidationPreview;
