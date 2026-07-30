"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { WifiOff } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { downloadCsv } from "@/lib/urlSyncAndExport";
import { deleteOutage } from "@/services/outages";
import { SeverityBadge } from "@/components/shared/SeverityBadgeAndShortcuts";
import type { Severity, OutageStatus } from "@/types/outages";

type Outage = {
  id: string;
  title: string;
  severity: Severity;
  status: OutageStatus;
  createdAt: string;
};

const STATUS_STYLE: Record<OutageStatus, string> = {
  open: "bg-amber-100 text-amber-800",
  resolved: "bg-emerald-100 text-emerald-800",
};

type Props = {
  data?: Outage[];
  /** Called after a successful bulk delete so the parent can refetch. */
  onRefresh?: () => void | Promise<void>;
};

// Stable identity — a `data = []` default would be a new array each render and
// would retrigger the sync effect below forever.
const EMPTY_OUTAGES: Outage[] = [];

export default function OutagesPageClient({
  data = EMPTY_OUTAGES,
  onRefresh,
}: Props) {
  const toast = useToast();

  // -----------------------------
  // State
  // -----------------------------
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "title">("date");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rows, setRows] = useState<Outage[]>(data);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Keep local rows in step with refreshed props.
  useEffect(() => {
    setRows(data);
  }, [data]);

  // -----------------------------
  // Derived Data (Search + Sort)
  // -----------------------------
  const filteredData = useMemo(() => {
    let result = [...rows];

    // Search
    if (search) {
      result = result.filter((item) =>
        item.title.toLowerCase().includes(search.toLowerCase()),
      );
    }

    // Sort
    if (sortBy === "date") {
      result.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }

    if (sortBy === "title") {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  }, [rows, search, sortBy]);

  // -----------------------------
  // Selection State (visible rows)
  // -----------------------------
  const selectedVisibleCount = useMemo(
    () => filteredData.filter((item) => selectedIds.includes(item.id)).length,
    [filteredData, selectedIds],
  );

  const allVisibleSelected =
    filteredData.length > 0 && selectedVisibleCount === filteredData.length;
  const someVisibleSelected =
    selectedVisibleCount > 0 && selectedVisibleCount < filteredData.length;

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
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
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
      selectedIds.map((id) => deleteOutage(id)),
    );

    const deletedIds = selectedIds.filter(
      (_, i) => outcomes[i].status === "fulfilled",
    );
    const failures = outcomes.filter((o) => o.status === "rejected");

    // Drop what actually went through, keep failures selected for a retry.
    if (deletedIds.length) {
      setRows((prev) => prev.filter((item) => !deletedIds.includes(item.id)));
    }
    setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(id)));

    if (failures.length) {
      const first = failures[0] as PromiseRejectedResult;
      const reason =
        first.reason instanceof Error ? first.reason.message : "Deletion failed.";
      const message =
        failures.length === selectedIds.length
          ? `Failed to delete ${failures.length} outage(s). ${reason}`
          : `Deleted ${deletedIds.length}, but ${failures.length} failed. ${reason}`;

      setDeleteError(message);
      toast(message, "error");
      setDeleting(false);
      return;
    }

    toast(
      `Deleted ${deletedIds.length} outage${deletedIds.length === 1 ? "" : "s"}.`,
      "success",
    );
    setShowDeleteConfirm(false);
    setDeleting(false);

    try {
      await onRefresh?.();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to refresh outages.",
        "error",
      );
    }
  }

  function handleExport() {
    if (!filteredData.length) {
      toast("There are no outages to export.", "info");
      return;
    }

    try {
      downloadCsv(
        "outages.csv",
        filteredData.map((item) => ({
          ID: item.id,
          Title: item.title,
          Severity: item.severity,
          Status: item.status,
          "Created At": new Date(item.createdAt).toISOString(),
        })),
      );
      toast(
        `Exported ${filteredData.length} outage${filteredData.length === 1 ? "" : "s"} to outages.csv.`,
        "success",
      );
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to export outages.",
        "error",
      );
    }
  }

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder="Search outages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-md px-3 py-2 w-full sm:max-w-sm"
        />

        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "date" | "title")}
            className="border rounded-md px-3 py-2"
          >
            <option value="date">Newest</option>
            <option value="title">Title</option>
          </select>

          <button
            onClick={handleExport}
            className="px-4 py-2 border rounded-md"
          >
            Export
          </button>

          <button
            onClick={() => {
              setDeleteError(null);
              setShowDeleteConfirm(true);
            }}
            disabled={!selectedIds.length || deleting}
            className="px-4 py-2 bg-red-500 text-white rounded-md disabled:opacity-50"
          >
            Delete{selectedIds.length ? ` (${selectedIds.length})` : ""}
          </button>
        </div>
      </div>

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
                  someVisibleSelected ? "mixed" : allVisibleSelected
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
                key={item.id}
                className="border rounded-lg p-4 flex items-center justify-between"
                tabIndex={0}
                role="button"
                aria-label={`View outage: ${item.title}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleSelect(item.id);
                  }
                }}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium">{item.title}</h3>
                    <SeverityBadge severity={item.severity} />
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium uppercase ${STATUS_STYLE[item.status]}`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>

                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  aria-label={`Select outage: ${item.title}`}
                />
              </div>
            ))
          ) : (
            <EmptyState
              icon={WifiOff}
              title="No outages to display"
              description={
                search
                  ? "Try adjusting your search query to find what you're looking for."
                  : "All systems are currently operational."
              }
              action={
                search
                  ? {
                      label: "Clear Search",
                      onClick: () => setSearch(""),
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
            <h2 id="bulk-delete-title" className="text-lg font-semibold text-slate-900">
              Delete {selectedIds.length} outage{selectedIds.length === 1 ? "" : "s"}?
            </h2>
            <p className="text-sm text-slate-600">
              This will permanently delete the selected outage
              {selectedIds.length === 1 ? "" : "s"}. This action cannot be undone.
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
                {deleting ? "Deleting…" : deleteError ? "Retry" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
