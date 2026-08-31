import type { SLADispute } from "@/types/sla";

export interface DisputeKpis {
  total: number;
  pendingApproval: number;
  approvalRatePct: number;
  avgResolutionHours: number | null;
}

export interface MonthlyTrendPoint {
  /** ISO month key, e.g. "2026-08". */
  month: string;
  label: string;
  count: number;
}

const PENDING_STATUSES = new Set(["open", "under_review"]);
const APPROVED_STATUSES = new Set(["resolved"]);

/**
 * Compute high-level dispute metrics from a list of disputes.
 * `avgResolutionHours` is null when no dispute has been resolved yet.
 */
export function computeDisputeKpis(disputes: SLADispute[]): DisputeKpis {
  const total = disputes.length;
  const pendingApproval = disputes.filter((d) =>
    PENDING_STATUSES.has(d.status),
  ).length;

  const resolved = disputes.filter((d) => APPROVED_STATUSES.has(d.status));
  const rejected = disputes.filter((d) => d.status === "rejected");

  const decided = resolved.length + rejected.length;
  const approvalRatePct = decided === 0 ? 0 : Math.round((resolved.length / decided) * 100);

  let resolutionMsSum = 0;
  let resolutionCount = 0;
  for (const d of disputes) {
    if (d.resolved_at) {
      const created = new Date(d.created_at).getTime();
      const resolvedAt = new Date(d.resolved_at).getTime();
      if (
        !Number.isNaN(created) &&
        !Number.isNaN(resolvedAt) &&
        resolvedAt >= created
      ) {
        resolutionMsSum += resolvedAt - created;
        resolutionCount += 1;
      }
    }
  }

  return {
    total,
    pendingApproval,
    approvalRatePct,
    avgResolutionHours:
      resolutionCount === 0
        ? null
        : Math.round((resolutionMsSum / resolutionCount / (60 * 60 * 1000)) * 10) / 10,
  };
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Group disputes by calendar month (based on `created_at`) and return the
 * monthly counts sorted chronologically.
 */
export function computeMonthlyTrend(disputes: SLADispute[]): MonthlyTrendPoint[] {
  const byMonth = new Map<string, number>();

  for (const d of disputes) {
    const created = new Date(d.created_at);
    if (Number.isNaN(created.getTime())) continue;

    const key = `${created.getUTCFullYear()}-${String(
      created.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => {
      const [year, monthIndex] = month.split("-");
      const label = `${MONTH_LABELS[Number(monthIndex) - 1] ?? monthIndex} ${year}`;
      return { month, label, count };
    });
}
