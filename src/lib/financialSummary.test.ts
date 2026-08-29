import { describe, it, expect } from "vitest";
import { aggregateMonthlyNet, computeFinancialTotals } from "./financialSummary";
import type { DashboardMetrics, TrendPoint } from "@/types/dashboard";

describe("aggregateMonthlyNet", () => {
  it("aggregates daily trend points into monthly totals", () => {
    const trends: TrendPoint[] = [
      { period: "2026-06-01", compliance_percentage: 90, penalties: 100, rewards: 50 },
      { period: "2026-06-15", compliance_percentage: 92, penalties: 50, rewards: 60 },
      { period: "2026-07-01", compliance_percentage: 95, penalties: 20, rewards: 80 },
    ];
    const monthly = aggregateMonthlyNet(trends);
    expect(monthly).toHaveLength(2);
    expect(monthly[0].monthKey).toBe("2026-06");
    expect(monthly[0].penalties).toBe(150);
    expect(monthly[0].rewards).toBe(110);
    expect(monthly[0].net).toBe(-40);
    expect(monthly[1].monthKey).toBe("2026-07");
    expect(monthly[1].net).toBe(60);
  });

  it("sorts months chronologically", () => {
    const trends: TrendPoint[] = [
      { period: "2026-07-01", compliance_percentage: 90, penalties: 0, rewards: 0 },
      { period: "2026-01-01", compliance_percentage: 90, penalties: 0, rewards: 0 },
    ];
    const monthly = aggregateMonthlyNet(trends);
    expect(monthly.map((m) => m.monthKey)).toEqual(["2026-01", "2026-07"]);
  });

  it("falls back to the raw period as a bucket key for non-date periods", () => {
    const trends: TrendPoint[] = [
      { period: "Week 1", compliance_percentage: 90, penalties: 10, rewards: 5 },
    ];
    const monthly = aggregateMonthlyNet(trends);
    expect(monthly).toEqual([
      { monthKey: "Week 1", label: "Week 1", penalties: 10, rewards: 5, net: -5 },
    ]);
  });

  it("returns an empty array for no trend data", () => {
    expect(aggregateMonthlyNet([])).toEqual([]);
  });
});

describe("computeFinancialTotals", () => {
  it("computes totals and net settlement from dashboard metrics", () => {
    const metrics: DashboardMetrics = {
      sla_compliance_percentage: 90,
      penalties: { total: 300, count: 3 },
      rewards: { total: 500, count: 5 },
      trends: [],
    };
    expect(computeFinancialTotals(metrics)).toEqual({
      totalPenalties: 300,
      totalRewards: 500,
      netSettlement: 200,
    });
  });

  it("handles a net-negative settlement", () => {
    const metrics: DashboardMetrics = {
      sla_compliance_percentage: 80,
      penalties: { total: 900, count: 9 },
      rewards: { total: 100, count: 1 },
      trends: [],
    };
    expect(computeFinancialTotals(metrics).netSettlement).toBe(-800);
  });
});
