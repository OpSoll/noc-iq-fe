import { describe, it, expect } from "vitest";

import type { SLADispute } from "@/types/sla";

import { computeDisputeKpis, computeMonthlyTrend } from "../disputeStats";

function dispute(overrides: Partial<SLADispute>): SLADispute {
  return {
    id: "d1",
    outage_id: "o1",
    status: "open",
    reason: "test",
    created_at: "2026-08-10T00:00:00Z",
    ...overrides,
  };
}

describe("computeDisputeKpis", () => {
  it("computes totals and pending from an empty list", () => {
    const kpis = computeDisputeKpis([]);
    expect(kpis).toEqual({
      total: 0,
      pendingApproval: 0,
      approvalRatePct: 0,
      avgResolutionHours: null,
    });
  });

  it("computes approval rate from resolved/rejected", () => {
    const kpis = computeDisputeKpis([
      dispute({ status: "resolved" }),
      dispute({ status: "resolved", id: "d2" }),
      dispute({ status: "rejected", id: "d3" }),
    ]);
    expect(kpis.total).toBe(3);
    expect(kpis.pendingApproval).toBe(0);
    expect(kpis.approvalRatePct).toBe(67);
  });

  it("counts open and under_review as pending", () => {
    const kpis = computeDisputeKpis([
      dispute({ status: "open" }),
      dispute({ status: "under_review", id: "d2" }),
      dispute({ status: "resolved", id: "d3" }),
    ]);
    expect(kpis.pendingApproval).toBe(2);
  });

  it("computes average resolution time in hours", () => {
    const kpis = computeDisputeKpis([
      dispute({
        status: "resolved",
        created_at: "2026-08-10T00:00:00Z",
        resolved_at: "2026-08-10T02:00:00Z",
      }),
      dispute({
        id: "d2",
        status: "resolved",
        created_at: "2026-08-11T00:00:00Z",
        resolved_at: "2026-08-11T06:00:00Z",
      }),
    ]);
    expect(kpis.avgResolutionHours).toBe(4);
  });

  it("returns null average when nothing is resolved", () => {
    const kpis = computeDisputeKpis([dispute({ status: "open" })]);
    expect(kpis.avgResolutionHours).toBeNull();
  });
});

describe("computeMonthlyTrend", () => {
  it("groups disputes by month chronologically", () => {
    const trend = computeMonthlyTrend([
      dispute({ created_at: "2026-07-05T00:00:00Z" }),
      dispute({ id: "d2", created_at: "2026-08-01T00:00:00Z" }),
      dispute({ id: "d3", created_at: "2026-08-20T00:00:00Z" }),
    ]);
    expect(trend).toEqual([
      { month: "2026-07", label: "Jul 2026", count: 1 },
      { month: "2026-08", label: "Aug 2026", count: 2 },
    ]);
  });

  it("returns empty for an empty list", () => {
    expect(computeMonthlyTrend([])).toEqual([]);
  });
});
