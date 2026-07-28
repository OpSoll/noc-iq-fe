import type { DashboardMetrics } from "@/types/dashboard";

export interface DashboardSnapshotFilters {
  date_from?: string;
  date_to?: string;
  severity?: string;
  site?: string;
}

export interface DashboardSnapshot {
  schema_version: "dashboard.snapshot.v1";
  exported_at: string;
  label: string;
  is_empty: boolean;
  filters: DashboardSnapshotFilters;
  share_url: string;
  metrics: DashboardMetrics;
}

function toQueryString(filters: DashboardSnapshotFilters, compareMode: boolean) {
  const params = new URLSearchParams();
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.site) params.set("site", filters.site);
  if (compareMode) params.set("compare", "1");
  return params.toString();
}

export function buildDashboardShareUrl(
  origin: string,
  pathname: string,
  filters: DashboardSnapshotFilters,
  compareMode: boolean,
) {
  const query = toQueryString(filters, compareMode);
  return query ? `${origin}${pathname}?${query}` : `${origin}${pathname}`;
}

export function buildDashboardSnapshot(
  metrics: DashboardMetrics,
  filters: DashboardSnapshotFilters,
  label: string,
  shareUrl: string,
): DashboardSnapshot {
  const isEmpty =
    metrics.trends.length === 0 &&
    metrics.penalties.count === 0 &&
    metrics.rewards.count === 0 &&
    metrics.penalties.total === 0 &&
    metrics.rewards.total === 0;

  return {
    schema_version: "dashboard.snapshot.v1",
    exported_at: new Date().toISOString(),
    label,
    is_empty: isEmpty,
    filters,
    share_url: shareUrl,
    metrics,
  };
}
