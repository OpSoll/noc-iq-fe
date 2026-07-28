import { api } from "@/lib/api";
import type {
  PaginatedPayments,
  Payment,
  PaymentHistoryEntry,
  ReconciliationStatus,
} from "@/types/payment";

export interface PaymentFilters {
  page?: number;
  page_size?: number;
  status?: string;
  type?: string;
  date_from?: string;
  date_to?: string;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
}

interface PaymentHistoryResponse {
  total?: number;
  transactions?: unknown[];
  items?: unknown[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function asNullableString(value: unknown): string | null {
  const next = asString(value);
  return next || null;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asAmountString(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return value.toFixed(2);
  return "0.00";
}

function toReconciliationStatus(value: unknown): ReconciliationStatus | null {
  const next = asString(value).toLowerCase();
  if (!next) return null;
  return next as ReconciliationStatus;
}

export function normalizePayment(raw: unknown): Payment {
  const record = asRecord(raw);
  const amountRaw = record.amount ?? record.amount_usdc ?? record.amountUsdc;

  return {
    id: asString(record.id),
    outageId: asNullableString(record.outage_id ?? record.outageId),
    type: asString(record.type ?? "manual"),
    amount: asAmountString(amountRaw),
    amountValue: asNumber(amountRaw),
    assetCode: asString(record.asset_code ?? record.assetCode ?? record.asset ?? "USDC"),
    transactionHash: asNullableString(
      record.transaction_hash ?? record.transactionHash ?? record.tx_hash ?? record.txHash,
    ),
    fromAddress: asNullableString(record.from_address ?? record.fromAddress ?? record.from),
    toAddress: asNullableString(record.to_address ?? record.toAddress ?? record.to),
    status: asString(record.status ?? "pending"),
    createdAt: asString(record.created_at ?? record.createdAt ?? record.timestamp),
    confirmedAt: asNullableString(record.confirmed_at ?? record.confirmedAt),
    explorerUrl: asNullableString(record.explorer_url ?? record.explorerUrl),
    slaResultId:
      typeof record.sla_result_id === "number"
        ? record.sla_result_id
        : typeof record.slaResultId === "number"
          ? record.slaResultId
          : null,
    commissionId: asNullableString(record.commission_id ?? record.commissionId),
    clientWallet: asNullableString(record.client_wallet ?? record.clientWallet ?? record.to_address),
    artistWallet: asNullableString(record.artist_wallet ?? record.artistWallet ?? record.from_address),
    platformFeeUsdc: asNullableString(record.platform_fee_usdc ?? record.platformFeeUsdc),
    reconciliationStatus: toReconciliationStatus(
      record.reconciliation_status ?? record.reconciliationStatus,
    ),
  };
}

export function normalizePaymentHistoryEntry(
  raw: unknown,
  fallbackPaymentId = "",
): PaymentHistoryEntry {
  const record = asRecord(raw);
  const metadata = record.metadata;

  return {
    id: asString(record.id ?? record.event_id ?? record.history_id ?? crypto.randomUUID()),
    paymentId: asString(record.payment_id ?? record.paymentId ?? record.id ?? fallbackPaymentId),
    status: asString(record.status ?? record.to_status ?? record.next_status ?? "unknown"),
    previousStatus: asNullableString(
      record.previous_status ?? record.previousStatus ?? record.from_status,
    ),
    timestamp: asString(record.timestamp ?? record.created_at ?? record.createdAt),
    eventType: asString(record.event_type ?? record.eventType ?? "status_change"),
    actor: asNullableString(record.actor ?? record.actor_name ?? record.updated_by),
    note: asNullableString(record.note ?? record.reason ?? record.message),
    correlationId: asNullableString(record.correlation_id ?? record.correlationId),
    metadata: typeof metadata === "object" && metadata !== null ? (metadata as Record<string, unknown>) : null,
  };
}

export const fetchPayments = async (
  filters: PaymentFilters = {},
): Promise<PaginatedPayments> => {
  const { page = 1, page_size = 10, ...rest } = filters;
  const response = await api.get<PaginatedPayments & { transactions?: unknown[] }>("/payments", {
    params: { page, page_size, ...rest },
  });
  const data = response.data;
  const items = Array.isArray(data.items)
    ? data.items
    : Array.isArray(data.transactions)
      ? data.transactions
      : [];

  return {
    items: items.map(normalizePayment),
    total: typeof data.total === "number" ? data.total : items.length,
    page: typeof data.page === "number" ? data.page : page,
    page_size: typeof data.page_size === "number" ? data.page_size : page_size,
  };
};

export const fetchPayment = async (id: string, signal?: AbortSignal): Promise<Payment> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await api.get<unknown>(`/payments/${id}`, { signal } as any);
  return normalizePayment(response.data);
};

export const fetchPaymentHistory = async (
  payment: Pick<Payment, "id" | "outageId" | "transactionHash">,
): Promise<PaymentHistoryEntry[]> => {
  const response = await api.get<PaymentHistoryResponse>("/payments/history", {
    params: {
      payment_id: payment.id,
      id: payment.id,
      outage_id: payment.outageId ?? undefined,
      transaction_hash: payment.transactionHash ?? undefined,
      limit: 100,
      offset: 0,
    },
  });

  const rows = Array.isArray(response.data.transactions)
    ? response.data.transactions
    : Array.isArray(response.data.items)
      ? response.data.items
      : [];

  return rows
    .map((entry) => normalizePaymentHistoryEntry(entry, payment.id))
    .filter((entry) => {
      if (entry.paymentId === payment.id) return true;
      if (payment.transactionHash && entry.metadata) {
        const tx = asString(entry.metadata.transaction_hash ?? entry.metadata.tx_hash);
        if (tx && tx === payment.transactionHash) return true;
      }
      return entry.paymentId === payment.id;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

export const retryPayment = async (id: string, payload?: { note?: string }): Promise<Payment> => {
  const response = await api.post<unknown>(`/payments/${id}/retry`, payload);
  return normalizePayment(response.data);
};

export const reconcilePayment = async (id: string, payload?: { note?: string }): Promise<Payment> => {
  const response = await api.post<unknown>(`/payments/${id}/reconcile`, payload);
  return normalizePayment(response.data);
};

export const exportPayments = async (filters: Omit<PaymentFilters, "page" | "page_size"> = {}): Promise<void> => {
  const response = await api.get("/payments/export", {
    params: filters,
    responseType: "blob",
  });
  const url = URL.createObjectURL(response.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const PaymentService = {
  fetchPayments,
  fetchPayment,
  fetchPaymentHistory,
  retryPayment,
  reconcilePayment,
  exportPayments,
};
