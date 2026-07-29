import { describe, expect, it } from "vitest";

import {
  normalizePayment,
  normalizePaymentHistoryEntry,
} from "@/services/paymentService";

describe("payment normalization", () => {
  it("normalizes snake_case payment responses for the drawer and table", () => {
    const payment = normalizePayment({
      id: "pay_123",
      outage_id: "out_99",
      type: "penalty",
      amount: "42.50",
      asset_code: "USDC",
      transaction_hash: "tx_456",
      from_address: "GAAA",
      to_address: "GBBB",
      status: "FAILED",
      created_at: "2026-07-28T10:00:00Z",
      reconciliation_status: "manual_review",
    });

    expect(payment).toMatchObject({
      id: "pay_123",
      outageId: "out_99",
      type: "penalty",
      amount: "42.50",
      amountValue: 42.5,
      assetCode: "USDC",
      transactionHash: "tx_456",
      fromAddress: "GAAA",
      toAddress: "GBBB",
      status: "FAILED",
      createdAt: "2026-07-28T10:00:00Z",
      reconciliationStatus: "manual_review",
    });
  });

  it("supports camelCase fallback fields from mixed API responses", () => {
    const payment = normalizePayment({
      id: "pay_777",
      type: "reward",
      amountUsdc: 15,
      assetCode: "XLM",
      txHash: "tx_camel",
      createdAt: "2026-07-28T11:00:00Z",
      clientWallet: "GCLIENT",
      artistWallet: "GARTIST",
    });

    expect(payment.amount).toBe("15.00");
    expect(payment.amountValue).toBe(15);
    expect(payment.transactionHash).toBe("tx_camel");
    expect(payment.clientWallet).toBe("GCLIENT");
    expect(payment.artistWallet).toBe("GARTIST");
  });
});

describe("payment history normalization", () => {
  it("preserves status transitions and audit metadata", () => {
    const entry = normalizePaymentHistoryEntry(
      {
        event_id: "hist_1",
        payment_id: "pay_123",
        previous_status: "PENDING",
        status: "CONFIRMED",
        event_type: "status_change",
        actor_name: "noc-operator",
        note: "Reconciled against settlement batch",
        correlation_id: "corr_9",
        created_at: "2026-07-28T12:00:00Z",
        metadata: { batch_id: "batch_42" },
      },
      "pay_123",
    );

    expect(entry).toMatchObject({
      id: "hist_1",
      paymentId: "pay_123",
      previousStatus: "PENDING",
      status: "CONFIRMED",
      eventType: "status_change",
      actor: "noc-operator",
      note: "Reconciled against settlement batch",
      correlationId: "corr_9",
      timestamp: "2026-07-28T12:00:00Z",
    });
    expect(entry.metadata).toEqual({ batch_id: "batch_42" });
  });
});
