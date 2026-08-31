"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { flagDispute, getDisputes, resolveDispute } from "@/services/sla";
import type { DisputeStatus, SLADispute } from "@/types/sla";

const PAGE_SIZE = 5;

const STATUS_OPTIONS = [
  "",
  "open",
  "under_review",
  "resolved",
  "rejected",
] as const;

const statusVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "default"
> = {
  open: "destructive",
  under_review: "secondary",
  resolved: "default",
  rejected: "outline",
};

interface Props {
  outageId: string;
  canResolve?: boolean;
}

interface ResolvePayload {
  disputeId: string;
  action: "resolve" | "reject";
  note?: string;
}

export function SLADisputesPanel({ outageId, canResolve = false }: Props) {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<DisputeStatus | "">("");
  const [page, setPage] = useState(1);
  const [reason, setReason] = useState("");
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  const queryKey = useMemo(
    () => ["sla-disputes", outageId, statusFilter, page],
    [outageId, statusFilter, page],
  );

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey,
    queryFn: () =>
      getDisputes({
        outage_id: outageId,
        status: statusFilter || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
    placeholderData: (previous) => previous,
    staleTime: 30_000,
    enabled: Boolean(outageId),
  });

  const disputes: SLADispute[] = data?.items ?? [];
  const total = data?.total ?? 0;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const invalidateDisputes = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["sla-disputes", outageId],
    });
  };

  const flagMutation = useMutation({
    mutationFn: async () =>
      flagDispute({
        outage_id: outageId,
        reason: reason.trim(),
      }),

    onSuccess: async () => {
      setReason("");
      await invalidateDisputes();
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ disputeId, action, note }: ResolvePayload) =>
      resolveDispute(disputeId, {
        action,
        resolution_note: note,
      }),

    onSuccess: async () => {
      await invalidateDisputes();
    },
  });

  const handleAction = (dispute: SLADispute, action: "resolve" | "reject") => {
    const note = noteInputs[dispute.id]?.trim();

    resolveMutation.mutate({
      disputeId: dispute.id,
      action,
      note: note || undefined,
    });

    setNoteInputs((prev) => ({
      ...prev,
      [dispute.id]: "",
    }));
  };

  const isSubmitting = flagMutation.isPending || resolveMutation.isPending;

  return (
    <Card className="md:col-span-2">
      <CardHeader className="space-y-1 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>SLA Disputes</CardTitle>

          {isFetching && !isLoading ? (
            <span className="text-xs text-slate-400">Refreshing...</span>
          ) : null}
        </div>

        <p className="text-sm text-slate-500">
          Track, resolve, and manage SLA-related outage disputes.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Create dispute */}
        <div className="space-y-2">
          <label
            htmlFor="dispute-reason"
            className="text-sm font-medium text-slate-700"
          >
            Flag new dispute
          </label>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="dispute-reason"
              className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder="Describe the issue..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={flagMutation.isPending}
              maxLength={300}
            />

            <Button
              variant="outline"
              disabled={!reason.trim() || flagMutation.isPending}
              onClick={() => flagMutation.mutate()}
            >
              {flagMutation.isPending ? "Submitting..." : "Flag dispute"}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {reason.length}/300 characters
            </span>

            {flagMutation.isSuccess ? (
              <span className="text-xs text-green-600">
                Dispute submitted successfully.
              </span>
            ) : null}
          </div>

          {flagMutation.isError ? (
            <p className="text-xs text-red-600">
              Failed to flag dispute. Please try again.
            </p>
          ) : null}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Filter
          </span>

          {STATUS_OPTIONS.map((status) => {
            const isActive = statusFilter === status;

            return (
              <button
                key={status || "all"}
                type="button"
                onClick={() => {
                  setStatusFilter(status);
                  setPage(1);
                }}
                className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {status === "" ? "All" : status.replace("_", " ")}
              </button>
            );
          })}
        </div>

        {/* Loading */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-lg border border-slate-100 p-4"
              >
                <div className="mb-3 h-4 w-24 rounded bg-slate-200" />
                <div className="mb-2 h-3 w-full rounded bg-slate-100" />
                <div className="h-3 w-2/3 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : null}

        {/* Error */}
        {isError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">
              Failed to load disputes
            </p>

            <p className="mt-1 text-xs text-red-600">
              {(error as Error)?.message ?? "Something went wrong."}
            </p>
          </div>
        ) : null}

        {/* Empty state */}
        {!isLoading && !isError && disputes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              No disputes found
            </p>

            <p className="mt-1 text-xs text-slate-500">
              There are currently no disputes matching this filter.
            </p>
          </div>
        ) : null}

        {/* Disputes */}
        {!isLoading &&
          disputes.map((dispute, index) => {
            const noteValue = noteInputs[dispute.id] ?? "";

            return (
              <div key={dispute.id}>
                {index > 0 ? <Separator className="my-4" /> : null}

                <div className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={statusVariant[dispute.status] ?? "outline"}
                        className="capitalize"
                      >
                        {dispute.status.replace("_", " ")}
                      </Badge>

                      <span className="text-xs text-slate-400">
                        #{dispute.id.slice(0, 8)}
                      </span>
                    </div>

                    <span className="text-xs text-slate-400">
                      {new Date(dispute.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-sm leading-relaxed text-slate-700">
                      {dispute.reason}
                    </p>
                  </div>

                  {dispute.resolution_note ? (
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-medium text-slate-500">
                        Resolution Note
                      </p>

                      <p className="mt-1 text-sm text-slate-700">
                        {dispute.resolution_note}
                      </p>
                    </div>
                  ) : null}

                  {/* Resolver actions */}
                  {canResolve && dispute.status === "open" ? (
                    <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <input
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                        placeholder="Optional resolution note..."
                        value={noteValue}
                        onChange={(e) =>
                          setNoteInputs((prev) => ({
                            ...prev,
                            [dispute.id]: e.target.value,
                          }))
                        }
                        disabled={isSubmitting}
                        maxLength={200}
                      />

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={isSubmitting}
                          onClick={() => handleAction(dispute, "resolve")}
                        >
                          {resolveMutation.isPending
                            ? "Processing..."
                            : "Resolve"}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSubmitting}
                          onClick={() => handleAction(dispute, "reject")}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}

        {/* Pagination */}
        {totalPages > 1 ? (
          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500">
              Showing page <span className="font-medium">{page}</span> of{" "}
              <span className="font-medium">{totalPages}</span> ({total} total
              disputes)
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((prev) => prev - 1)}
              >
                Previous
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => prev + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Stellar Wave #504: Dispute search by SLA Result ID or Outage ID
// ============================================================

interface DisputeSearchProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

function DisputeSearchInput({ onSearch, placeholder }: DisputeSearchProps) {
  const [searchValue, setSearchValue] = useState("");

  const handleSearch = (value: string) => {
    setSearchValue(value);
    onSearch(value);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={searchValue}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder={placeholder ?? "Search by SLA Result ID or Outage ID..."}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
      />
      {searchValue && (
        <Button variant="ghost" size="sm" onClick={() => handleSearch("")}>
          Clear
        </Button>
      )}
    </div>
  );
}

function filterDisputesBySearch(
  disputes: SLADispute[],
  query: string
): SLADispute[] {
  if (!query.trim()) return disputes;
  const lower = query.toLowerCase();
  return disputes.filter(
    (d) =>
      d.sla_result_id?.toLowerCase().includes(lower) ||
      d.outage_id?.toLowerCase().includes(lower) ||
      d.id?.toLowerCase().includes(lower)
  );
}

// ============================================================
// Stellar Wave #500: Bulk dispute status resolution actions
// ============================================================

interface BulkActionToolbarProps {
  selectedIds: string[];
  onBulkAction: (action: "resolve" | "reject") => void;
  onClearSelection: () => void;
}

function BulkActionToolbar({
  selectedIds,
  onBulkAction,
  onClearSelection,
}: BulkActionToolbarProps) {
  if (selectedIds.length === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-4 py-2">
      <span className="text-sm text-muted-foreground">
        {selectedIds.length} dispute(s) selected
      </span>
      <Button
        size="sm"
        variant="default"
        onClick={() => onBulkAction("resolve")}
      >
        Bulk Resolve
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => onBulkAction("reject")}
      >
        Bulk Reject
      </Button>
      <Button size="sm" variant="ghost" onClick={onClearSelection}>
        Clear
      </Button>
    </div>
  );
}

function useBulkDisputeActions(invalidateFn: () => Promise<void>) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = (ids: string[]) => setSelectedIds(ids);
  const clearSelection = () => setSelectedIds([]);

  const bulkResolve = useMutation({
    mutationFn: async (action: "resolve" | "reject") => {
      const results = await Promise.allSettled(
        selectedIds.map((id) =>
          resolveDispute(id, {
            action,
            resolution_note: `Bulk ${action} via Stellar Wave`,
          })
        )
      );
      return results;
    },
    onSuccess: async () => {
      clearSelection();
      await invalidateFn();
    },
  });

  return {
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    bulkResolve,
  };
}

// ============================================================
// Stellar Wave #505: SLA credit adjustment preview modal
// ============================================================

interface CreditPreviewModalProps {
  disputeId: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

interface CreditAdjustment {
  currentBalance: number;
  adjustmentAmount: number;
  newBalance: number;
  currency: string;
  reason: string;
}

function useCreditPreview(disputeId: string) {
  return useQuery({
    queryKey: ["credit-preview", disputeId],
    queryFn: async (): Promise<CreditAdjustment> => {
      const response = await api.get(`/sla/disputes/${disputeId}/preview`);
      return response.data;
    },
    enabled: !!disputeId,
  });
}

function CreditPreviewModal({
  disputeId,
  isOpen,
  onClose,
  onConfirm,
}: CreditPreviewModalProps) {
  const { data: adjustment, isLoading } = useCreditPreview(disputeId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>SLA Credit Adjustment Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">
              Loading preview...
            </div>
          ) : adjustment ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">
                  Current Balance:
                </span>
                <span className="font-mono">
                  {adjustment.currentBalance} {adjustment.currency}
                </span>
                <span className="text-muted-foreground">Adjustment:</span>
                <span className="font-mono text-destructive">
                  -{adjustment.adjustmentAmount} {adjustment.currency}
                </span>
                <span className="text-muted-foreground">New Balance:</span>
                <span className="font-mono font-semibold">
                  {adjustment.newBalance} {adjustment.currency}
                </span>
              </div>
              <Separator />
              <p className="text-sm text-muted-foreground">
                {adjustment.reason}
              </p>
            </>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={onConfirm}
              disabled={isLoading}
            >
              Confirm Resolution
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Stellar Wave #501: Export dispute audit log to PDF
// ============================================================

interface AuditLogEntry {
  disputeId: string;
  outageId: string;
  slaResultId: string;
  status: string;
  reason: string;
  resolutionNote: string;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

function generateAuditPDF(entries: AuditLogEntry[]): string {
  const lines: string[] = [];
  lines.push("DISPUTE AUDIT LOG");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Total Entries: ${entries.length}`);
  lines.push("=".repeat(60));

  for (const entry of entries) {
    lines.push("");
    lines.push(`Dispute ID:  ${entry.disputeId}`);
    lines.push(`Outage ID:   ${entry.outageId}`);
    lines.push(`SLA Result:  ${entry.slaResultId}`);
    lines.push(`Status:      ${entry.status}`);
    lines.push(`Created:     ${entry.createdAt}`);
    lines.push(`Resolved:    ${entry.resolvedAt ?? "N/A"}`);
    lines.push(`By:          ${entry.resolvedBy ?? "N/A"}`);
    lines.push(`Reason:      ${entry.reason}`);
    lines.push(`Note:        ${entry.resolutionNote}`);
    lines.push("-".repeat(40));
  }

  return lines.join("\n");
}

async function exportAuditToPDF(
  disputes: SLADispute[],
  filename: string
): Promise<void> {
  const entries: AuditLogEntry[] = disputes.map((d) => ({
    disputeId: d.id,
    outageId: d.outage_id,
    slaResultId: d.sla_result_id ?? "",
    status: d.status,
    reason: d.reason ?? "",
    resolutionNote: d.resolution_note ?? "",
    createdAt: d.created_at,
    resolvedAt: d.resolved_at ?? null,
    resolvedBy: d.resolved_by ?? null,
  }));

  const content = generateAuditPDF(entries);
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function useExportAuditLog() {
  return useMutation({
    mutationFn: async (params: {
      outageId?: string;
      status?: string;
    }) => {
      const response = await api.get("/sla/disputes", {
        params: { ...params, page_size: 1000 },
      });
      const disputes = response.data.items ?? [];
      await exportAuditToPDF(
        disputes,
        `audit-log-${new Date().toISOString().slice(0, 10)}.pdf`
      );
    },
  });
}
