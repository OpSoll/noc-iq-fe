'use client';

/**
 * ValidationPreview
 *
 * Table of the parsed upload used as the last wizard step: every record is
 * listed with its file line number, cells that a validation error points at
 * are highlighted, and a row with errors can be expanded to read them. A
 * "show only errors" checkbox collapses the noise when most of the file is
 * clean, which is the normal case for a large export.
 *
 * The row building and the filtering are plain functions so the wizard can be
 * reasoned about (and tested) without rendering anything.
 *
 * Closes #627 - Bulk Import: Add validation preview with per-row errors
 */

import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { ImportValidationError } from '@/types/bulkImport';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Line 1 of a CSV is the header, so the first record sits on line 2. */
const FIRST_RECORD_LINE = 2;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ValidationRow {
  /** 1-based line number in the uploaded file. */
  line: number;
  /** Cell values, positionally aligned with the headers. */
  cells: string[];
  /** Errors reported for this line. */
  errors: ImportValidationError[];
}

// ─── Row building ────────────────────────────────────────────────────────────

/**
 * Joins the records with the errors that reference them. Errors without a
 * line (a missing required column, for instance) belong to the file as a
 * whole and are reported by the error summary instead, so they are skipped
 * here.
 */
export function buildValidationRows(
  records: string[][],
  errors: ImportValidationError[]
): ValidationRow[] {
  const errorsByLine = new Map<number, ImportValidationError[]>();

  for (const error of errors) {
    if (error.row == null) continue;

    const existing = errorsByLine.get(error.row);
    if (existing) {
      existing.push(error);
    } else {
      errorsByLine.set(error.row, [error]);
    }
  }

  return records.map((cells, index) => {
    const line = index + FIRST_RECORD_LINE;

    return { line, cells, errors: errorsByLine.get(line) ?? [] };
  });
}

/** Rows to render, hiding the clean ones when `onlyErrors` is set. */
export function computeVisibleRows(
  rows: ValidationRow[],
  onlyErrors: boolean
): ValidationRow[] {
  return onlyErrors ? rows.filter((row) => row.errors.length > 0) : rows;
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ValidationPreviewProps {
  /** Header row of the parsed file. */
  headers: string[];
  /** Records to list, in file order. */
  records: string[][];
  /** Validation errors for the whole file. */
  errors: ImportValidationError[];
  /** Row count of the file, which can exceed `records.length`. */
  totalRows: number;
  /** Headers that are mandatory, rendered with an asterisk. */
  requiredFields?: readonly string[];
  /** Extra classes for the wrapper. */
  className?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ValidationPreview({
  headers,
  records,
  errors,
  totalRows,
  requiredFields = [],
  className,
}: ValidationPreviewProps) {
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [openLines, setOpenLines] = useState<ReadonlySet<number>>(
    () => new Set()
  );

  const rows = useMemo(
    () => buildValidationRows(records, errors),
    [records, errors]
  );
  const invalidCount = useMemo(
    () => rows.filter((row) => row.errors.length > 0).length,
    [rows]
  );
  const visibleRows = useMemo(
    () => computeVisibleRows(rows, onlyErrors),
    [rows, onlyErrors]
  );

  function toggleLine(line: number) {
    setOpenLines((previous) => {
      const next = new Set(previous);

      if (next.has(line)) {
        next.delete(line);
      } else {
        next.add(line);
      }

      return next;
    });
  }

  function errorFor(row: ValidationRow, column: number): string | undefined {
    const field = headers[column];
    if (!field) return undefined;

    return row.errors.find((error) => error.field === field)?.message;
  }

  return (
    <section
      className={cn('overflow-hidden rounded-lg border bg-white', className)}
      aria-label="Import preview"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-gray-50 px-4 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Preview
        </p>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={onlyErrors}
            disabled={invalidCount === 0}
            onChange={(event) => setOnlyErrors(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
          />
          Show only errors
        </label>
      </div>

      {invalidCount > 0 && (
        <p className="border-b bg-red-50 px-4 py-1.5 text-xs text-red-700">
          {invalidCount} of {rows.length} row{rows.length === 1 ? '' : 's'}{' '}
          need attention
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">
                Row
              </th>
              {headers.map((header, index) => {
                const required = requiredFields.includes(header);

                return (
                  <th
                    key={`${header}-${index}`}
                    className={cn(
                      'px-3 py-2 text-left font-semibold',
                      required ? 'text-blue-700' : 'text-gray-600'
                    )}
                    title={required ? 'Required field' : undefined}
                  >
                    {header}
                    {required && (
                      <span className="ml-0.5 text-blue-500" aria-hidden="true">
                        *
                      </span>
                    )}
                    {required && <span className="sr-only"> (required)</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={headers.length + 1}
                  className="px-3 py-4 text-center text-xs text-gray-500"
                >
                  No rows to show.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const open = openLines.has(row.line);
                const hasErrors = row.errors.length > 0;

                return (
                  <Fragment key={row.line}>
                    <tr
                      className={cn(
                        'border-t transition-colors hover:bg-gray-50',
                        hasErrors && 'bg-red-50'
                      )}
                    >
                      <td className="px-3 py-2 text-gray-500">
                        {hasErrors ? (
                          <button
                            type="button"
                            onClick={() => toggleLine(row.line)}
                            aria-expanded={open}
                            aria-label={`${
                              open ? 'Hide' : 'Show'
                            } errors for row ${row.line}`}
                            className="flex items-center gap-1 rounded font-semibold text-red-600 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500"
                          >
                            {open ? (
                              <ChevronDown
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            ) : (
                              <ChevronRight
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            )}
                            {row.line}
                          </button>
                        ) : (
                          row.line
                        )}
                      </td>
                      {row.cells.map((cell, index) => {
                        const message = errorFor(row, index);

                        return (
                          <td
                            key={`${row.line}-${index}`}
                            className={cn(
                              'max-w-[200px] truncate px-3 py-2',
                              message
                                ? 'bg-red-100 font-medium text-red-800'
                                : 'text-gray-700'
                            )}
                            title={message ?? cell}
                          >
                            {cell}
                          </td>
                        );
                      })}
                    </tr>
                    {hasErrors && open && (
                      <tr className="border-t bg-red-50">
                        <td colSpan={headers.length + 1} className="px-3 py-2">
                          <ul className="space-y-0.5 text-xs text-red-700">
                            {row.errors.map((error, index) => (
                              <li key={`${error.field ?? 'row'}-${index}`}>
                                {error.field && (
                                  <span className="font-semibold">
                                    [{error.field}]{' '}
                                  </span>
                                )}
                                {error.message}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="border-t px-4 py-2 text-xs text-gray-400">
        {totalRows > records.length
          ? `Showing ${visibleRows.length} of ${totalRows} rows`
          : `${visibleRows.length} row${visibleRows.length === 1 ? '' : 's'}`}
      </p>
    </section>
  );
}
