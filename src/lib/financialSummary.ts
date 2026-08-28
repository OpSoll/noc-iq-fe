import type { DashboardMetrics, TrendPoint } from "@/types/dashboard";

// Closes #452: SLA penalty/reward aggregate financial widget helpers

export interface MonthlyNetPoint {
  monthKey: string;
  label: string;
  penalties: number;
  rewards: number;
  net: number;
}

// Matches ISO-ish date strings (e.g. "2026-06-01" or "2026-06-01T00:00:00Z").
// Anything else (e.g. a "Week 1" style label) is treated as its own bucket,
// since JS's loose Date parser can otherwise misinterpret arbitrary strings.
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;

function monthKeyFor(period: string): { key: string; label: string } {
  if (ISO_DATE_PATTERN.test(period)) {
    const date = new Date(period);
    if (!Number.isNaN(date.getTime())) {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = date.toLocaleString(undefined, { month: "short", year: "2-digit" });
      return { key, label };
    }
  }
  // Fall back to the raw period value as its own bucket when it isn't a parseable ISO date.
  return { key: period, label: period };
}

/** Aggregates trend points (typically daily) into monthly penalty/reward/net totals. */
export function aggregateMonthlyNet(trends: TrendPoint[]): MonthlyNetPoint[] {
  const byMonth = new Map<string, MonthlyNetPoint>();

  for (const point of trends) {
    const { key, label } = monthKeyFor(point.period);
    const existing = byMonth.get(key);
    if (existing) {
      existing.penalties += point.penalties;
      existing.rewards += point.rewards;
      existing.net = existing.rewards - existing.penalties;
    } else {
      byMonth.set(key, {
        monthKey: key,
        label,
        penalties: point.penalties,
        rewards: point.rewards,
        net: point.rewards - point.penalties,
      });
    }
  }

  return Array.from(byMonth.values()).sort((a, b) => (a.monthKey < b.monthKey ? -1 : 1));
}

export interface FinancialTotals {
  totalPenalties: number;
  totalRewards: number;
  netSettlement: number;
}

export function computeFinancialTotals(metrics: DashboardMetrics): FinancialTotals {
  return {
    totalPenalties: metrics.penalties.total,
    totalRewards: metrics.rewards.total,
    netSettlement: metrics.rewards.total - metrics.penalties.total,
  };
}
