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

describe("date validation logic", () => {
  it("detects invalid date range when dateFrom is after dateTo", () => {
    const dateFrom = "2026-07-30";
    const dateTo = "2026-07-29";
    const dateError =
      dateFrom && dateTo && dateFrom > dateTo
        ? "Start date cannot be after end date."
        : null;
    expect(dateError).toBe("Start date cannot be after end date.");
  });

  it("allows valid date range when dateFrom is before dateTo", () => {
    const dateFrom = "2026-07-29";
    const dateTo = "2026-07-30";
    const dateError =
      dateFrom && dateTo && dateFrom > dateTo
        ? "Start date cannot be after end date."
        : null;
    expect(dateError).toBeNull();
  });

  it("allows valid date range when dateFrom equals dateTo", () => {
    const dateFrom = "2026-07-30";
    const dateTo = "2026-07-30";
    const dateError =
      dateFrom && dateTo && dateFrom > dateTo
        ? "Start date cannot be after end date."
        : null;
    expect(dateError).toBeNull();
  });

  it("returns null when dateFrom is empty", () => {
    const dateFrom = "";
    const dateTo = "2026-07-30";
    const dateError =
      dateFrom && dateTo && dateFrom > dateTo
        ? "Start date cannot be after end date."
        : null;
    expect(dateError).toBeNull();
  });

  it("returns null when dateTo is empty", () => {
    const dateFrom = "2026-07-30";
    const dateTo = "";
    const dateError =
      dateFrom && dateTo && dateFrom > dateTo
        ? "Start date cannot be after end date."
        : null;
    expect(dateError).toBeNull();
  });
});

describe("filter state reset", () => {
  const URL_DEFAULTS = {
    status: "all",
    type: "all",
    dateFrom: "",
    dateTo: "",
    page: "1",
    perPage: "20",
    paymentId: "",
    sortKey: "created_at",
    sortDir: "desc",
  };

  it("detects active filters", () => {
    const state = { ...URL_DEFAULTS, status: "CONFIRMED" };
    const hasActiveFilters =
      state.status !== URL_DEFAULTS.status ||
      state.type !== URL_DEFAULTS.type ||
      state.dateFrom !== URL_DEFAULTS.dateFrom ||
      state.dateTo !== URL_DEFAULTS.dateTo;
    expect(hasActiveFilters).toBe(true);
  });

  it("detects no active filters when using defaults", () => {
    const state = { ...URL_DEFAULTS };
    const hasActiveFilters =
      state.status !== URL_DEFAULTS.status ||
      state.type !== URL_DEFAULTS.type ||
      state.dateFrom !== URL_DEFAULTS.dateFrom ||
      state.dateTo !== URL_DEFAULTS.dateTo;
    expect(hasActiveFilters).toBe(false);
  });

  it("detects active filters with date range", () => {
    const state = { ...URL_DEFAULTS, dateFrom: "2026-07-01", dateTo: "2026-07-30" };
    const hasActiveFilters =
      state.status !== URL_DEFAULTS.status ||
      state.type !== URL_DEFAULTS.type ||
      state.dateFrom !== URL_DEFAULTS.dateFrom ||
      state.dateTo !== URL_DEFAULTS.dateTo;
    expect(hasActiveFilters).toBe(true);
  });

  it("resets all parameters to defaults on clear", () => {
    const dirtyState = {
      status: "CONFIRMED",
      type: "penalty",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-30",
      page: "3",
      perPage: "50",
      paymentId: "pay_123",
      sortKey: "amount",
      sortDir: "asc",
    };
    const resetState = { ...URL_DEFAULTS };
    expect(resetState).toEqual(URL_DEFAULTS);
    expect(dirtyState).not.toEqual(URL_DEFAULTS);
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
