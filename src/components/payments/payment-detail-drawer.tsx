"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "@/hooks/useSession";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useToast } from "@/components/ui/toast";
import { PaymentService } from "@/services/paymentService";
import type { PaginatedPayments, Payment } from "@/types/payment";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RefreshCcw, Scale, X } from "lucide-react";
import { explorerLink, STELLAR_NETWORK_LABEL } from "@/lib/explorer";
import { queryKeys } from "@/lib/queryKeys";

interface PaymentDetailDrawerProps {
  paymentId: string | null;
  onClose: () => void;
}

function formatMoney(payment: Payment) {
  return `${payment.amount} ${payment.assetCode}`;
}

function getStatusBadge(status: string) {
  switch (status.toUpperCase()) {
    case "CONFIRMED":
      return "bg-green-100 text-green-700";
    case "RELEASED":
      return "bg-blue-100 text-blue-700";
    case "REFUNDED":
      return "bg-yellow-100 text-yellow-700";
    case "FAILED":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function getReconciliationBadge(status?: string | null) {
  switch ((status ?? "").toLowerCase()) {
    case "matched":
      return "bg-green-50 text-green-700";
    case "mismatched":
      return "bg-red-50 text-red-700";
    case "manual_review":
      return "bg-amber-50 text-amber-700";
    case "pending":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function updatePaymentsCache(
  current: PaginatedPayments | undefined,
  updated: Payment,
) {
  if (!current) return current;
  return {
    ...current,
    items: current.items.map((item) =>
      item.id === updated.id ? updated : item,
    ),
  };
}

export function PaymentDetailDrawer({
  paymentId,
  onClose,
}: PaymentDetailDrawerProps) {
  const id = paymentId ?? "";

  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [showFullHistory, setShowFullHistory] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useSession();

  useFocusTrap(drawerRef, Boolean(id), onClose);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    drawerRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleEscape);
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  const { data: payment, isLoading } = useQuery({
    queryKey: queryKeys.payments.detail(id),
    queryFn: () => PaymentService.fetchPayment(id),
    enabled: !!id,
  });

  const {
    data: history = [],
    isLoading: isHistoryLoading,
    isError: isHistoryError,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: [
      ...queryKeys.payments.detail(id),
      "history",
      payment?.transactionHash,
    ],
    queryFn: () => PaymentService.fetchPaymentHistory(payment!),
    enabled: !!payment,
    staleTime: 60_000,
  });

  function syncCaches(updated: Payment) {
    queryClient.setQueryData(queryKeys.payments.detail(id), updated);
    queryClient.setQueriesData<PaginatedPayments>(
      { queryKey: queryKeys.payments.all },
      (current) => updatePaymentsCache(current, updated),
    );
    queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  }

  const retryMutation = useMutation({
    mutationFn: () =>
      PaymentService.retryPayment(id, { note: actionNote.trim() || undefined }),
    onSuccess: (updatedPayment) => {
      syncCaches(updatedPayment);
      void refetchHistory();
      setActionNote("");
      toast("Payment retry submitted.", "success");
    },
    onError: (error) => {
      toast(
        error instanceof Error ? error.message : "Failed to retry payment.",
        "error",
      );
    },
  });

  const reconcileMutation = useMutation({
    mutationFn: () =>
      PaymentService.reconcilePayment(id, {
        note: actionNote.trim() || undefined,
      }),
    onSuccess: (updatedPayment) => {
      syncCaches(updatedPayment);
      void refetchHistory();
      setActionNote("");
      toast("Payment reconciliation queued.", "success");
    },
    onError: (error) => {
      toast(
        error instanceof Error ? error.message : "Failed to reconcile payment.",
        "error",
      );
    },
  });

  if (!id) return null;

  if (isLoading || !payment) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/30" onClick={onClose} />
        <div
          className="relative flex w-full max-w-md flex-col bg-white p-6 shadow-xl"
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Loading payment details"
        >
          <div className="flex-1 space-y-4 pt-12">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const role = user?.role ?? null;
  const isPrivilegedOperator = role === "admin" || role === "engineer";
  const normalizedStatus = payment.status.toUpperCase();
  const reconciliationState = payment.reconciliationStatus ?? "untracked";
  const canRetry = isPrivilegedOperator && normalizedStatus === "FAILED";
  const canReconcile =
    isPrivilegedOperator &&
    ["CONFIRMED", "RELEASED", "REFUNDED"].includes(normalizedStatus) &&
    reconciliationState !== "matched";
  const visibleHistory = showFullHistory ? history : history.slice(0, 6);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={drawerRef}
        className="relative flex w-full max-w-xl flex-col bg-white p-6 shadow-xl transition-transform"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        tabIndex={-1}
      >
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 id="drawer-title" className="text-lg font-semibold">
              Payment Details
            </h2>
            <span
              className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500"
              title="Stellar network"
            >
              {STELLAR_NETWORK_LABEL}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Payment ID
                </p>
                <p className="font-mono text-sm text-slate-800">{payment.id}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadge(payment.status)}`}
                >
                  {payment.status}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getReconciliationBadge(payment.reconciliationStatus)}`}
                >
                  Reconciliation: {reconciliationState.replace("_", " ")}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Amount</p>
              <p className="font-medium">{formatMoney(payment)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Type</p>
              <p className="font-medium capitalize">{payment.type}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Created</p>
              <p className="font-medium">
                {payment.createdAt
                  ? new Date(payment.createdAt).toLocaleString()
                  : "Unknown"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Commission</p>
              <p className="font-medium font-mono text-sm">
                {payment.commissionId
                  ? `${payment.commissionId.slice(0, 12)}...`
                  : "Unavailable"}
              </p>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-gray-500">Client Wallet</p>
            {(() => {
              const addr = payment.clientWallet ?? payment.toAddress;
              const link = explorerLink("account", addr);
              if (!addr)
                return (
                  <p className="font-mono text-sm text-gray-400">Unavailable</p>
                );
              return link ? (
                <a
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-sm break-all text-blue-600 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {addr}
                </a>
              ) : (
                <p className="font-mono text-sm break-all">{addr}</p>
              );
            })()}
          </div>
          <div>
            <p className="text-sm text-gray-500">Artist Wallet</p>
            {(() => {
              const addr = payment.artistWallet ?? payment.fromAddress;
              const link = explorerLink("account", addr);
              if (!addr)
                return (
                  <p className="font-mono text-sm text-gray-400">Unavailable</p>
                );
              return link ? (
                <a
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-sm break-all text-blue-600 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {addr}
                </a>
              ) : (
                <p className="font-mono text-sm break-all">{addr}</p>
              );
            })()}
          </div>
          {payment.transactionHash && (
            <div>
              <p className="text-sm text-gray-500">Transaction Hash</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm break-all">
                  {payment.transactionHash}
                </p>
                {(() => {
                  const href =
                    payment.explorerUrl ??
                    explorerLink("tx", payment.transactionHash);
                  return href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Explorer
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null;
                })()}
              </div>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-500">Platform Fee</p>
            <p className="font-medium">
              {payment.platformFeeUsdc
                ? `${payment.platformFeeUsdc} USDC`
                : "Unavailable"}
            </p>
          </div>

          {canRetry || canReconcile ? (
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-slate-800">
                  Operations
                </h3>
                <p className="text-sm text-slate-500">
                  Run manual retry or reconciliation actions when the current
                  payment state allows it.
                </p>
              </div>
              <label
                htmlFor="action-note"
                className="mb-1 block text-sm text-gray-500"
              >
                Operator note (optional)
              </label>
              <textarea
                id="action-note"
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                className="mb-3 w-full rounded border px-3 py-2 text-sm"
                rows={3}
                placeholder="Add context for the retry or reconciliation action..."
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                {canRetry ? (
                  <button
                    type="button"
                    onClick={() => retryMutation.mutate()}
                    disabled={
                      retryMutation.isPending || reconcileMutation.isPending
                    }
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    {retryMutation.isPending ? "Retrying..." : "Retry Payment"}
                  </button>
                ) : null}
                {canReconcile ? (
                  <button
                    type="button"
                    onClick={() => reconcileMutation.mutate()}
                    disabled={
                      retryMutation.isPending || reconcileMutation.isPending
                    }
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:opacity-50"
                  >
                    <Scale className="h-4 w-4" />
                    {reconcileMutation.isPending
                      ? "Reconciling..."
                      : "Reconcile Payment"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Manual retry and reconciliation controls are unavailable for the
              current payment state or your role.
            </div>
          )}

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  History & Audit Trail
                </h3>
                <p className="text-sm text-slate-500">
                  Status transitions and operational context for this payment.
                </p>
              </div>
              {history.length > 6 ? (
                <button
                  type="button"
                  onClick={() => setShowFullHistory((value) => !value)}
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  {showFullHistory
                    ? "Show recent only"
                    : `Show all (${history.length})`}
                </button>
              ) : null}
            </div>

            {isHistoryLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-14 animate-pulse rounded-lg bg-slate-100"
                  />
                ))}
              </div>
            ) : isHistoryError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p>We could not load the payment history right now.</p>
                <button
                  type="button"
                  onClick={() => void refetchHistory()}
                  className="mt-2 font-medium hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : history.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No payment history is available yet.
              </div>
            ) : (
              <div className="space-y-3">
                {visibleHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {entry.previousStatus
                            ? `${entry.previousStatus} -> ${entry.status}`
                            : entry.status}
                        </p>
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          {entry.eventType.replace("_", " ")}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500">
                        {entry.timestamp
                          ? new Date(entry.timestamp).toLocaleString()
                          : "Unknown time"}
                      </p>
                    </div>
                    {entry.actor ? (
                      <p className="mt-2 text-sm text-slate-600">
                        Actor: {entry.actor}
                      </p>
                    ) : null}
                    {entry.note ? (
                      <p className="mt-1 text-sm text-slate-600">
                        {entry.note}
                      </p>
                    ) : null}
                    {entry.correlationId ? (
                      <p className="mt-1 font-mono text-xs text-slate-500">
                        Correlation: {entry.correlationId}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
