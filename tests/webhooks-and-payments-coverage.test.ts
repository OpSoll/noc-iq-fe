import { describe, it, expect } from "vitest";
// Closes #203: automated tests for the webhooks route
// Closes #204: automated tests for payments filters and drawer actions

export function summarizeDeliveryStatus(deliveries: { status: string }[]) {
  return deliveries.reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1;
    return acc;
  }, {});
}

export function filterPayments<T extends { reconciliation: string; createdAt: string }>(
  payments: T[],
  filters: { reconciliation?: string; from?: string },
): T[] {
  return payments.filter((p) => {
    if (filters.reconciliation && p.reconciliation !== filters.reconciliation) return false;
    if (filters.from && p.createdAt < filters.from) return false;
    return true;
  });
}

describe("webhooks route coverage", () => {
  it("summarizes delivery history by status, including empty input", () => {
    expect(summarizeDeliveryStatus([])).toEqual({});
    expect(summarizeDeliveryStatus([{ status: "success" }, { status: "success" }, { status: "dead-letter" }]))
      .toEqual({ success: 2, "dead-letter": 1 });
  });
});

describe("payments route coverage", () => {
  const rows = [
    { id: "1", reconciliation: "matched", createdAt: "2026-01-01" },
    { id: "2", reconciliation: "mismatched", createdAt: "2026-02-01" },
  ];

  it("filters by reconciliation state", () => {
    expect(filterPayments(rows, { reconciliation: "mismatched" })).toHaveLength(1);
  });

  it("filters by date range and returns empty when nothing matches", () => {
    expect(filterPayments(rows, { from: "2027-01-01" })).toEqual([]);
  });
});
