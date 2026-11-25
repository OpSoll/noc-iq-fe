'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, SlidersHorizontal, WifiOff } from 'lucide-react';
import {
  HighlightedText,
  OutageSearchBar,
  matchesSearchTerm,
} from '@/components/outages/OutageSearchBar';
import { ExportButton } from '@/components/outages/ExportButton';
import { downloadOutagesCsv } from '@/lib/outagesDurationAndExport';
import { OutageDurationCounter } from '@/components/outages/OutageDurationCounter';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { useUrlSync } from '@/hooks/useUrlSync';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { deleteOutage, getOutages, resolveOutage } from '@/services/outages';
import { RowActions } from '@/components/tables/RowActions';
import { SeverityBadge } from '@/components/shared/SeverityBadgeAndShortcuts';
import SeverityLegend from '@/components/outages/SeverityLegend';
import { TableStatusPill } from '@/components/outages/TableStatusPill';
import SlaStatusBadge from '@/components/outages/SlaStatusBadge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSession } from '@/hooks/useSession';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { formatRelativeTime, formatTimestamp } from '@/lib/time';
import type {
  Outage as OutageRecord,
  OutageStatus,
  Severity,
} from '@/types/outages';
import type { SLAResult } from '@/types/sla';

type Outage = {
  id: string;
  title: string;
  severity: Severity;
  status: OutageStatus;
  createdAt: string;
  assigned_to?: string;
  sla_status?: SLAResult;
};

const STATUS_STYLE: Record<OutageStatus, string> = {
  open: 'bg-amber-100 text-amber-800',
  resolved: 'bg-emerald-100 text-emerald-800',
};

/**
 * The rows the page owns are a summary shape; the row action menu operates on
 * the full API record, so the local fields are mapped onto it (description and
 * affected services have no local counterpart and are filled with blanks).
 */
function toOutageRecord(row: Outage): OutageRecord {
  return {
    id: row.id,
    site_name: row.title,
    severity: row.severity,
    status: row.status,
    detected_at: row.createdAt,
    description: '',
    affected_services: [],
    assigned_to: row.assigned_to,
    sla_status: row.sla_status,
  };
}

/**
 * Stable React key for an outage row. Using the id (rather than the map index)
 * keeps a row's DOM node and selection state when the list is reordered or a
 * different outage is removed.
 */
export function getOutageRowKey(outage: Outage): string {
  return outage.id;
}

type Props = {
  data?: Outage[];
  /** Called after a successful bulk delete so the parent can refetch. */
  onRefresh?: () => void | Promise<void>;
};

// Stable identity — a `data = []` default would be a new array each render and
// would retrigger the sync effect below forever.
const FILTER_DEFAULTS = {
  search: '',
  severity: '',
  date_from: '',
  date_to: '',
  sort: 'date',
  assigned_to_me: '',
};

async function fetchOutageQueue() {
  const pageSize = 100;
  const firstPage = await getOutages({ page: 1, page_size: pageSize });
  const pageCount = Math.ceil(firstPage.total / pageSize);
  if (pageCount <= 1) return firstPage.items;

  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      getOutages({ page: index + 2, page_size: pageSize })
    )
  );
  return [...firstPage.items, ...remainingPages.flatMap((page) => page.items)];
}

export default function OutagesPageClient({ data, onRefresh }: Props) {
  const toast = useToast();
  const router = useRouter();
  const { user } = useSession();
  const {
    data: outageResponse,
    isLoading: isOutagesLoading,
    error: outagesError,
  } = useQuery({
    queryKey: queryKeys.outages.list({ scope: 'queue' }),
    queryFn: fetchOutageQueue,
    enabled: data === undefined,
  });
  const rawRows = (data ?? outageResponse ?? []) as any[];
  const outageRows: (Outage & {
    site_name?: string;
    detected_at?: string;
    resolved_at?: string;
    description?: string;
  })[] = useMemo(() => {
    return rawRows.map((outage) => ({
      ...outage,
      id: String(outage.id),
      title: (outage.title || outage.site_name || '') as string,
      severity: (outage.severity || 'low') as Severity,
      status: (outage.status || 'open') as OutageStatus,
      createdAt: (outage.createdAt ||
        outage.detected_at ||
        new Date().toISOString()) as string,
      detected_at: (outage.detected_at || outage.createdAt) as string | undefined,
      site_name: (outage.site_name || outage.title) as string | undefined,
      assigned_to: outage.assigned_to as string | undefined,
      sla_status: outage.sla_status as SLAResult | undefined,
    }));
  }, [data, outageResponse]);

  // -----------------------------
  // State
  // -----------------------------
  const [filters, setFilters] = useUrlSync(FILTER_DEFAULTS);
  const {
    search,
    severity,
    date_from: dateFrom,
    date_to: dateTo,
    sort,
    assigned_to_me: assignedToMe,
  } = filters;
  const sortBy = sort as 'date' | 'title';
  // A reversed range can never return rows. Keep it client-side so no query is
  // issued and the user gets an explanation instead of an empty table.
  const dateRangeError =
    dateFrom && dateTo && dateFrom > dateTo
      ? 'Start date cannot be after end date.'
      : null;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const rows = useMemo(
    () => outageRows.filter((item) => !removedIds.includes(item.id)),
    [outageRows, removedIds]
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // -----------------------------
  // Refresh status
  // -----------------------------
  // The rows the parent handed us are as fresh as this render, so the pill
  // starts at mount and only moves when something actually refetches.
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Polling is off until a caller opts in, and it pauses itself whenever the
  // tab is hidden (Page Visibility API, handled by the hook).
  const { refetchInterval, isPolling } = useAutoRefresh();

  const handleRefresh = useCallback(async () => {
    // No parent fetch wired up: there is nothing to refetch, so leave the
    // timestamp alone rather than pretending the data changed.
    if (!onRefresh) return;

    setIsRefreshing(true);

    try {
      await onRefresh();
      setLastUpdatedAt(new Date());
    } catch (err) {
      toast(
        err instanceof Error ? err.message : 'Failed to refresh outages.',
        'error'
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, toast]);

  useEffect(() => {
    if (!isPolling || refetchInterval === false) return;

    const id = setInterval(() => {
      void handleRefresh();
    }, refetchInterval);

    return () => clearInterval(id);
  }, [isPolling, refetchInterval, handleRefresh]);

  // -----------------------------
  // Derived Data (Search + Sort)
  // -----------------------------
  const filteredData = useMemo(() => {
    if (dateRangeError) return [];
    let result = [...rows];

    // Search — matches the outage id, site name and description (#616)
    if (search) {
      result = result.filter((item) => matchesSearchTerm(item, search));
    }

    if (severity) {
      result = result.filter((item) => item.severity === severity);
    }

    if (assignedToMe === 'true') {
      result = user?.id
        ? result.filter((item) => item.assigned_to === user.id)
        : [];
    }

    if (dateFrom) {
      result = result.filter((item) => item.createdAt.slice(0, 10) >= dateFrom);
    }

    if (dateTo) {
      result = result.filter((item) => item.createdAt.slice(0, 10) <= dateTo);
    }

    // Sort
    if (sortBy === 'date') {
      result.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    if (sortBy === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  }, [
    rows,
    search,
    severity,
    assignedToMe,
    user,
    dateFrom,
    dateTo,
    dateRangeError,
    sortBy,
  ]);

  // -----------------------------
  // Selection State (visible rows)
  // -----------------------------
  const selectedVisibleCount = useMemo(
    () => filteredData.filter((item) => selectedIds.includes(item.id)).length,
    [filteredData, selectedIds]
  );

  const allVisibleSelected =
    filteredData.length > 0 && selectedVisibleCount === filteredData.length;
  const someVisibleSelected =
    selectedVisibleCount > 0 && selectedVisibleCount < filteredData.length;
  const isEmptyDataset =
    !isOutagesLoading && !outagesError && rows.length === 0;

  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  // -----------------------------
  // Handlers
  // -----------------------------
  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    const visibleIds = filteredData.map((item) => item.id);

    setSelectedIds((prev) => {
      // Unchecking (or clearing an indeterminate state) drops every visible row.
      if (allVisibleSelected || someVisibleSelected) {
        return prev.filter((id) => !visibleIds.includes(id));
      }

      return [...new Set([...prev, ...visibleIds])];
    });
  }

  async function handleConfirmDelete() {
    if (!selectedIds.length) return;

    setDeleting(true);
    setDeleteError(null);

    // allSettled so one bad ID doesn't abandon the rest of the batch.
    const outcomes = await Promise.allSettled(
      selectedIds.map((id) => deleteOutage(id))
    );

    const deletedIds = selectedIds.filter(
      (_, i) => outcomes[i].status === 'fulfilled'
    );
    const failures = outcomes.filter((o) => o.status === 'rejected');

    // Drop what actually went through, keep failures selected for a retry.
    if (deletedIds.length) {
      setRemovedIds((prev) => [...new Set([...prev, ...deletedIds])]);
    }
    setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(id)));

    if (failures.length) {
      const first = failures[0] as PromiseRejectedResult;
      const reason =
        first.reason instanceof Error
          ? first.reason.message
          : 'Deletion failed.';
      const message =
        failures.length === selectedIds.length
          ? `Failed to delete ${failures.length} outage(s). ${reason}`
          : `Deleted ${deletedIds.length}, but ${failures.length} failed. ${reason}`;

      setDeleteError(message);
      toast(message, 'error');
      setDeleting(false);
      return;
    }

    toast(
      `Deleted ${deletedIds.length} outage${deletedIds.length === 1 ? '' : 's'}.`,
      'success'
    );
    setShowDeleteConfirm(false);
    setDeleting(false);

    // Same path as the status pill, so both the rows and the "updated" age
    // move together (it also reports a failed refetch).
    await handleRefresh();
  }

  // -----------------------------
  // Row actions (#617)
  // -----------------------------
  function handleRowViewDetails(outage: OutageRecord) {
    router.push(`/outages/${encodeURIComponent(outage.id)}`);
  }

  async function handleRowResolve(outage: OutageRecord) {
    try {
      const elapsed = Math.max(
        1,
        Math.round((Date.now() - Date.parse(outage.detected_at)) / 60_000)
      );
      await resolveOutage(outage.id, { mttr_minutes: elapsed });
      toast(`Resolved ${outage.site_name}.`, 'success');
      await onRefresh?.();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : 'Failed to resolve the outage.',
        'error'
      );
    }
  }

  async function handleRowSoftDelete(outage: OutageRecord) {
    try {
      await deleteOutage(outage.id);
      setRemovedIds((prev) => [...prev, outage.id]);
      toast(`Soft deleted ${outage.site_name}.`, 'success');
      await onRefresh?.();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : 'Failed to delete the outage.',
        'error'
      );
    }
  }

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <TooltipProvider>
      <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <OutageSearchBar
          value={search}
          onChange={(value) => setFilters({ search: value })}
          resultCount={filteredData.length}
          totalCount={rows.length}
        />

        <button
          type="button"
          data-testid="outage-filter-toggle"
          aria-expanded={filtersOpen}
          aria-controls="outage-filter-controls"
          onClick={() => setFiltersOpen((open) => !open)}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 md:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {filtersOpen ? 'Hide filters' : 'Filters'}
        </button>

        <div
          id="outage-filter-controls"
          data-testid="outage-filter-controls"
          className={`${filtersOpen ? 'flex' : 'hidden'} flex-wrap items-center gap-2 md:flex`}
        >
          <TableStatusPill
            updatedAt={lastUpdatedAt}
            isRefreshing={isRefreshing}
            onRefresh={onRefresh ? () => void handleRefresh() : undefined}
          />

          <select
            aria-label="Filter by severity"
            value={severity}
            onChange={(e) => setFilters({ severity: e.target.value })}
            className="border rounded-md px-3 py-2"
          >
            <option value="">All severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
            <button
              type="button"
              aria-pressed={assignedToMe === 'true'}
              disabled={!user?.id}
              title={
                !user?.id
                  ? 'Sign in to filter outages assigned to you.'
                  : undefined
              }
              onClick={() =>
                setFilters({
                  assigned_to_me: assignedToMe === 'true' ? '' : 'true',
                })
              }
              className={`rounded-md border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                assignedToMe === 'true'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Assigned to Me
            </button>
          {/* #1001: keyboard-accessible severity legend. */}
          <SeverityLegend />
          <label className="sr-only" htmlFor="outage-date-from">
            From date
          </label>
          <input
            id="outage-date-from"
            aria-label="From date"
            type="date"
            value={dateFrom}
            onChange={(e) => setFilters({ date_from: e.target.value })}
            aria-invalid={!!dateRangeError}
              aria-describedby={
                dateRangeError ? 'outage-date-range-error' : undefined
              }
            className={`border rounded-md px-3 py-2 ${dateRangeError ? 'border-red-500' : ''}`}
          />
          <label className="sr-only" htmlFor="outage-date-to">
            To date
          </label>
          <input
            id="outage-date-to"
            aria-label="To date"
            type="date"
            value={dateTo}
            onChange={(e) => setFilters({ date_to: e.target.value })}
            aria-invalid={!!dateRangeError}
              aria-describedby={
                dateRangeError ? 'outage-date-range-error' : undefined
              }
            className={`border rounded-md px-3 py-2 ${dateRangeError ? 'border-red-500' : ''}`}
          />

          <select
            value={sortBy}
            onChange={(e) => setFilters({ sort: e.target.value })}
            className="border rounded-md px-3 py-2"
          >
            <option value="date">Newest</option>
            <option value="title">Title</option>
          </select>

          <ExportButton
            rows={filteredData}
            onExported={({ rowCount, filename }) =>
              toast(`Exported ${rowCount} to ${filename}.`, 'success')
            }
          />

          <button
            type="button"
            onClick={() => downloadOutagesCsv(filteredData)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            aria-label="Export CSV"
            data-testid="export-csv-btn"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>

          <button
            onClick={() => {
              setDeleteError(null);
              setShowDeleteConfirm(true);
            }}
            disabled={!selectedIds.length || deleting}
            className="px-4 py-2 bg-red-500 text-white rounded-md disabled:opacity-50"
          >
            Delete{selectedIds.length ? ` (${selectedIds.length})` : ''}
          </button>
        </div>
      </div>

        {outagesError ? (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {outagesError instanceof Error
              ? outagesError.message
              : 'Failed to load outages.'}
          </p>
        ) : null}
        {isOutagesLoading ? (
          <p role="status" className="text-sm text-slate-500">
            Loading outages…
          </p>
        ) : null}

      {dateRangeError ? (
        <p
          id="outage-date-range-error"
          role="alert"
          aria-live="polite"
          data-testid="outage-date-range-error"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {dateRangeError}
        </p>
      ) : null}

      {/* List */}
      <div className="overflow-x-auto">
        {/* Header row */}
        {filteredData.length > 0 && (
          <div className="flex items-center justify-between border-b px-4 pb-2 mb-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                ref={selectAllRef}
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={allVisibleSelected}
                onChange={toggleSelectAll}
                aria-checked={
                  someVisibleSelected ? 'mixed' : allVisibleSelected
                }
                aria-label={`Select all outages, ${selectedVisibleCount} of ${filteredData.length} selected`}
              />
              <span aria-hidden="true">Select all</span>
            </label>

            <span className="text-sm text-muted-foreground" role="status">
              {selectedVisibleCount > 0
                ? `${selectedVisibleCount} of ${filteredData.length} selected`
                : `${filteredData.length} outages`}
            </span>
          </div>
        )}

        <div className="grid gap-4">
          {filteredData.length > 0 ? (
            filteredData.map((item) => (
              <div
                key={getOutageRowKey(item)}
                data-outage-id={getOutageRowKey(item)}
                data-testid={`incident-card-${item.id}`}
                className="border rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium">
                      <HighlightedText text={item.title} term={search} />
                    </h3>
                    <SeverityBadge severity={item.severity} />
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium uppercase ${STATUS_STYLE[item.status as OutageStatus] ?? 'bg-slate-100 text-slate-700'}`}
                    >
                      {item.status}
                    </span>
                    {item.status !== 'resolved' && (
                      <OutageDurationCounter
                        detectedAt={item.createdAt}
                        status={item.status}
                      />
                    )}
                    {item.sla_status ? (
                      <SlaStatusBadge
                        status={item.sla_status.status}
                        result={item.sla_status}
                        reasonCode={item.sla_status.reason_code}
                      />
                    ) : null}
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p
                        tabIndex={0}
                        className="text-sm text-muted-foreground outline-none focus-visible:underline"
                        aria-label={`Detected ${formatTimestamp(item.createdAt)}`}
                      >
                        {formatRelativeTime(item.createdAt)}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {formatTimestamp(item.createdAt)}
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="flex items-center gap-2">
                  <RowActions
                    outage={toOutageRecord(item)}
                    onViewDetails={handleRowViewDetails}
                    onResolve={handleRowResolve}
                    onSoftDelete={handleRowSoftDelete}
                    busy={deleting}
                  />

                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    aria-label={`Select outage: ${item.title}`}
                  />
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              icon={WifiOff}
              title="No outages to display"
              description={
                search
                  ? "Try adjusting your search query to find what you're looking for."
                    : assignedToMe === 'true'
                      ? 'There are no outages assigned to you.'
                  : 'All systems are currently operational.'
              }
              action={
                search
                  ? {
                      label: 'Clear Search',
                      onClick: () => setFilters({ search: '' }),
                    }
                    : assignedToMe === 'true'
                      ? {
                          label: 'Clear Assigned Filter',
                          onClick: () => setFilters({ assigned_to_me: '' }),
                        }
                  : isEmptyDataset
                    ? {
                        label: 'Log an outage',
                        onClick: () => router.push('/outages/new'),
                      }
                    : undefined
              }
            />
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-delete-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        >
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <h2
              id="bulk-delete-title"
              className="text-lg font-semibold text-slate-900"
            >
              Delete {selectedIds.length} outage
              {selectedIds.length === 1 ? '' : 's'}?
            </h2>
            <p className="text-sm text-slate-600">
              This will permanently delete the selected outage
              {selectedIds.length === 1 ? '' : 's'}. This action cannot be
              undone.
            </p>

            {deleteError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteError(null);
                }}
                disabled={deleting}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleConfirmDelete()}
                disabled={deleting || !selectedIds.length}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : deleteError ? 'Retry' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </TooltipProvider>
  );
}
