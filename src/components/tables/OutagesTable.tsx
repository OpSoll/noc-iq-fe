'use client';

/**
 * OutagesTable
 *
 * A TanStack Table–powered table for the outages list that exposes explicit
 * aria-sort attributes on every sortable <th> element so screen readers can
 * announce column sort direction (ascending / descending / none).
 *
 * Closes #710 – Accessibility: Add ARIA sort attributes to data table header elements
 */

import { useMemo, useState } from 'react';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { Severity, OutageStatus } from '@/types/outages';

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface OutageRow {
  id: string;
  title: string;
  severity: Severity;
  status: OutageStatus;
  createdAt: string;
}

// ─── aria-sort helpers ────────────────────────────────────────────────────────

/**
 * Maps a TanStack sort direction value to the ARIA sort token required by
 * WCAG 2.1 success criterion 4.1.2 and ARIA 1.2 spec §6.6.24.
 *
 *   false            → "none"        (column is sortable but not currently sorted)
 *   "asc"            → "ascending"
 *   "desc"           → "descending"
 *
 * Non-sortable columns receive aria-sort="none" as well to inform AT that the
 * column is present but ordering is not applicable.
 */
export function toAriaSortValue(
  isSorted: 'asc' | 'desc' | false
): 'ascending' | 'descending' | 'none' {
  if (isSorted === 'asc') return 'ascending';
  if (isSorted === 'desc') return 'descending';
  return 'none';
}

// ─── Status / Severity badge helpers ──────────────────────────────────────────

const STATUS_CLASSES: Record<OutageStatus, string> = {
  open: 'bg-amber-100 text-amber-800',
  resolved: 'bg-emerald-100 text-emerald-800',
};

const SEVERITY_CLASSES: Record<Severity, string> = {
  low: 'bg-sky-100 text-sky-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

function StatusBadge({ status }: { status: OutageStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium uppercase ${STATUS_CLASSES[status]}`}
    >
      {status}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium uppercase ${SEVERITY_CLASSES[severity]}`}
    >
      {severity}
    </span>
  );
}

// ─── Sort direction indicator icon ────────────────────────────────────────────

function SortIndicator({ direction }: { direction: 'asc' | 'desc' | false }) {
  if (!direction) {
    return (
      <svg
        className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-60 transition-opacity"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
        />
      </svg>
    );
  }
  return (
    <svg
      className={`h-3 w-3 transition-transform ${direction === 'desc' ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 15l7-7 7 7"
      />
    </svg>
  );
}

// ─── Column definitions ───────────────────────────────────────────────────────

function buildColumns(): ColumnDef<OutageRow>[] {
  return [
    {
      id: 'title',
      accessorKey: 'title',
      header: 'Title',
      enableSorting: true,
      cell: ({ row }) => (
        <span className="font-medium text-slate-900">{row.original.title}</span>
      ),
    },
    {
      id: 'severity',
      accessorKey: 'severity',
      header: 'Severity',
      enableSorting: true,
      cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      enableSorting: true,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'createdAt',
      accessorKey: 'createdAt',
      header: 'Created',
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-slate-600 text-xs">
          {new Date(row.original.createdAt).toLocaleString()}
        </span>
      ),
    },
  ];
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface OutagesTableProps {
  /** Outage rows to display. */
  data: OutageRow[];
  /** Controlled sort state; omit for uncontrolled internal sort. */
  sorting?: SortingState;
  /** Called when the user clicks a sortable column header. */
  onSortingChange?: (next: SortingState) => void;
  /** Accessible caption for the table. */
  caption?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * OutagesTable
 *
 * Renders outage rows with full ARIA sort support on every sortable <th>:
 *
 *   <th aria-sort="ascending">   when column is sorted A→Z / oldest→newest
 *   <th aria-sort="descending">  when column is sorted Z→A / newest→oldest
 *   <th aria-sort="none">        when column is sortable but not currently sorted
 *
 * The attribute is kept in sync dynamically on every sort toggle so screen
 * readers announce the change without a full-page reload.
 */
export function OutagesTable({
  data,
  sorting: externalSorting,
  onSortingChange,
  caption = 'Outages',
}: OutagesTableProps) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([
    { id: 'createdAt', desc: true },
  ]);

  const isControlled = externalSorting !== undefined;
  const sorting = isControlled ? externalSorting : internalSorting;

  const handleSortingChange = (
    updater: SortingState | ((prev: SortingState) => SortingState)
  ) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater;
    if (isControlled) {
      onSortingChange?.(next);
    } else {
      setInternalSorting(next);
    }
  };

  const columns = useMemo(() => buildColumns(), []);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm" aria-label={caption}>
        {/* Visible caption for assistive technology */}
        <caption className="sr-only">{caption}</caption>

        <thead className="bg-slate-50">
          {headerGroups.map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const canSort = h.column.getCanSort();
                const isSorted = h.column.getIsSorted();

                return (
                  // aria-sort is set on the <th> element as required by
                  // ARIA 1.2 §6.6.24 and WCAG 2.1 SC 4.1.2.
                  // The value updates on every toggle so AT can announce the
                  // new direction without re-reading the whole header.
                  <th
                    key={h.id}
                    scope="col"
                    aria-sort={toAriaSortValue(isSorted)}
                    aria-label={
                      canSort
                        ? `Sort by ${typeof h.column.columnDef.header === 'string' ? h.column.columnDef.header : h.id}, currently ${toAriaSortValue(isSorted)}`
                        : undefined
                    }
                    className={`px-4 py-3 text-left text-xs font-semibold text-slate-700 whitespace-nowrap ${
                      canSort ? 'group' : ''
                    }`}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={h.column.getToggleSortingHandler()}
                        className="flex items-center gap-1.5 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 rounded"
                        aria-label={`Sort by ${typeof h.column.columnDef.header === 'string' ? h.column.columnDef.header : h.id}, currently ${toAriaSortValue(isSorted)}`}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        <SortIndicator direction={isSorted} />
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="h-32 text-center text-sm text-slate-500"
              >
                No outages to display.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-slate-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
