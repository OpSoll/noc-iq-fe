export type PaymentType = "reward" | "penalty" | "manual" | string;
export type PaymentStatus = string;
export type ReconciliationStatus =
  | "pending"
  | "matched"
  | "mismatched"
  | "manual_review"
  | string;

export interface Payment {
  id: string;
  outageId: string | null;
  type: PaymentType;
  amount: string;
  amountValue: number;
  assetCode: string;
  transactionHash: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  status: PaymentStatus;
  createdAt: string;
  confirmedAt?: string | null;
  explorerUrl?: string | null;
  slaResultId?: number | null;
  commissionId?: string | null;
  clientWallet?: string | null;
  artistWallet?: string | null;
  platformFeeUsdc?: string | null;
  reconciliationStatus?: ReconciliationStatus | null;
}

export interface PaginatedPayments {
  items: Payment[];
  total: number;
  page: number;
  page_size: number;
}

export interface PaymentHistoryEntry {
  id: string;
  paymentId: string;
  status: string;
  previousStatus?: string | null;
  timestamp: string;
  eventType: string;
  actor?: string | null;
  note?: string | null;
  correlationId?: string | null;
  metadata?: Record<string, unknown> | null;
}
