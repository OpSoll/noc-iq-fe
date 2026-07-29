"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import KPICard from "@/components/dashboard/KPICard";
import PenaltiesRewardsChart from "@/components/dashboard/PenaltiesRewardsChart";
import SLATrendChart from "@/components/dashboard/SLATrendChart";
import { useToast } from "@/components/ui/toast";
import { RouteErrorState, RouteLoadingState } from "@/components/ui/route-state";
import {
  buildDashboardShareUrl,
  buildDashboardSnapshot,
} from "@/lib/dashboardSnapshot";
import { useUrlSync } from "@/hooks/useUrlSync";
import { fetchDashboardMetrics, type DashboardFilters } from "@/services/dashboardService";
import type { DashboardMetrics, TrendPoint } from "@/types/dashboard";

function delta(a: number, b: number) {
  const d = a - b;
  return `${d >= 0 ? "+" : ""}${d.toFixed(1)}`;
}

const SEVERITIES = ["", "low", "medium", "high", "critical"];
const DASHBOARD_DEFAULTS = {
  date_from: "",
  date_to: "",
  severity: "",
  site: "",
  compare: "0",
};

export default function SLADashboardView() {
  const router = useRouter();
  const toast = useToast();
  const [urlState, setUrlState] = useUrlSync(DASHBOARD_DEFAULTS);
  const compareMode = urlState.compare === "1";
  const filters = useMemo<DashboardFilters>(
    () => ({
      date_from: urlState.date_from || undefined,
      date_to: urlState.date_to || undefined,
      severity: urlState.severity || undefined,
      site: urlState.site || undefined,
    }),
    [urlState],
  );

  function set(key: keyof DashboardFilters, value: string) {
    setUrlState({ [key]: value || "", compare: compareMode ? "1" : "0" });
  }

  function setCompareMode(value: boolean) {
    setUrlState({ compare: value ? "1" : "0" });
  }

  function buildSnapshotUrl() {
    return buildDashboardShareUrl(
      window.location.origin,
      window.location.pathname,
      filters,
      compareMode,
    );
  }

  function downloadSnapshot(metrics: DashboardMetrics) {
    const snapshot = buildDashboardSnapshot(
      metrics,
      filters,
      "dashboard",
      buildSnapshotUrl(),
    );
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sla-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast(
      snapshot.is_empty
        ? "Empty dashboard snapshot exported."
        : "Dashboard snapshot exported.",
      "success",
    );
  }

  async function shareSnapshot(metrics: DashboardMetrics) {
    try {
      const snapshotUrl = buildSnapshotUrl();
      const snapshot = buildDashboardSnapshot(
        metrics,
        filters,
        "dashboard",
        snapshotUrl,
      );
      const shareText = snapshot.is_empty
        ? "Dashboard snapshot shared with the current empty-state filters."
        : "Dashboard snapshot shared with the current filters and time range.";

      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: "NOC IQ dashboard snapshot",
          text: shareText,
          url: snapshotUrl,
        });
      } else {
        await navigator.clipboard.writeText(snapshotUrl);
      }
      toast("Dashboard snapshot link copied.", "success");
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? null
          : error instanceof Error
            ? error.message
            : "Failed to share the dashboard snapshot.";
      if (message) {
        toast(message, "error");
      }
    }
  }

  function pushOutageDrilldown(point?: TrendPoint) {
    const params = new URLSearchParams();
    if (filters.severity) params.set("severity", filters.severity);
    if (filters.site) {
      params.set("site", filters.site);
      params.set("search", filters.site);
    }
    if (point?.period) params.set("date_from", point.period);
    if (filters.date_from) params.set("date_from", filters.date_from);
    if (filters.date_to) params.set("date_to", filters.date_to);
    router.push(`/outages?${params.toString()}`);
  }

  function pushPaymentDrilldown(type: "penalty" | "reward", point?: TrendPoint) {
    const params = new URLSearchParams();
    params.set("type", type);
    if (point?.period) {
      params.set("dateFrom", point.period);
      params.set("dateTo", point.period);
    } else {
      if (filters.date_from) params.set("dateFrom", filters.date_from);
      if (filters.date_to) params.set("dateTo", filters.date_to);
    }
    router.push(`/payments?${params.toString()}`);
  }

  const primary = useQuery<DashboardMetrics>({
    queryKey: ["dashboard-metrics", filters],
    queryFn: () => fetchDashboardMetrics(filters),
    staleTime: 30_000,
  });

  const secondary = useQuery<DashboardMetrics>({
    queryKey: ["dashboard-metrics-compare", compareMode],
    queryFn: () => fetchDashboardMetrics(),
    staleTime: 30_000,
    enabled: compareMode,
  });

  function onTrendClick(point: TrendPoint) {
    pushOutageDrilldown(point);
  }

  function onPenaltyClick(point: TrendPoint) {
    pushPaymentDrilldown("penalty", point);
  }

  function onRewardClick(point: TrendPoint) {
    pushPaymentDrilldown("reward", point);
  }

  if (primary.isLoading) {
    return (
      <RouteLoadingState
        title="Loading dashboard"
        description="Pulling the latest SLA compliance, trends, and payout metrics."
      />
    );
  }

  if (primary.isError || !primary.data) {
    return (
      <RouteErrorState
        title="Dashboard unavailable"
        description="We could not load the latest analytics right now."
        primaryAction={{ label: "Retry", onClick: () => void primary.refetch() }}
        
      />
    );
  }

  const metrics = primary.data;
  const netBalance = metrics.rewards.total - metrics.penalties.total;
  const lastUpdated = primary.dataUpdatedAt
    ? new Date(primary.dataUpdatedAt).toLocaleString()
    : "Not synced yet";
  const cmp = compareMode && secondary.data ? secondary.data : null;
  const isEmptyDataset =
    metrics.trends.length === 0 &&
    metrics.penalties.count === 0 &&
    metrics.rewards.count === 0;

  function applyPreset(days: number | "month" | "ytd") {
    const to = new Date();
    const from = new Date();
    if (typeof days === "number") {
      from.setDate(from.getDate() - days);
    } else if (days === "month") {
      from.setDate(1);
    } else if (days === "ytd") {
      from.setMonth(0, 1);
    }
    const toStr = to.toISOString().split("T")[0];
    const fromStr = from.toISOString().split("T")[0];
    setUrlState({ ...urlState, date_from: fromStr, date_to: toStr, compare: compareMode ? "1" : "0" });
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-800">SLA Analytics Dashboard</h1>
          <p className="text-sm text-gray-500">Live backend analytics for compliance, payouts, and trend movement.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-gray-400">Updated {lastUpdated}</span>
          <button
            type="button"
            onClick={() => setCompareMode(!compareMode)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${compareMode ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            {compareMode ? "Exit Compare" : "Compare"}
          </button>
          <button type="button" onClick={() => downloadSnapshot(metrics)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">Export</button>
          <button type="button" onClick={() => void shareSnapshot(metrics)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">Share snapshot</button>
          <button type="button" onClick={() => void primary.refetch()} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">Refresh</button>
        </div>
      </div>

      {compareMode && secondary.isLoading ? (
        <p className="text-sm text-gray-400">Loading comparison window…</p>
      ) : null}

      <div className="flex gap-2 text-sm text-slate-600 mb-2">
        <button type="button" onClick={() => applyPreset(7)} className="hover:underline">Last 7 Days</button>
        <button type="button" onClick={() => applyPreset(30)} className="hover:underline">Last 30 Days</button>
        <button type="button" onClick={() => applyPreset("month")} className="hover:underline">This Month</button>
        <button type="button" onClick={() => applyPreset("ytd")} className="hover:underline">Year to Date</button>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <label className="space-y-1 text-xs">
          <span className="font-medium text-slate-600">From</span>
          <input type="date" className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm" value={filters.date_from ?? ""} onChange={(e) => set("date_from", e.target.value)} />
        </label>
        <label className="space-y-1 text-xs">
          <span className="font-medium text-slate-600">To</span>
          <input type="date" className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm" value={filters.date_to ?? ""} onChange={(e) => set("date_to", e.target.value)} />
        </label>
        <label className="space-y-1 text-xs">
          <span className="font-medium text-slate-600">Severity</span>
          <select className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm" value={filters.severity ?? ""} onChange={(e) => set("severity", e.target.value)}>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s || "All"}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="font-medium text-slate-600">Site</span>
          <input type="text" placeholder="e.g. site-a" className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm" value={filters.site ?? ""} onChange={(e) => set("site", e.target.value)} />
        </label>
      </div>

      {isEmptyDataset ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No dashboard data matches the current filters yet. Export and share still include the active filter state so you can reference the empty view.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="SLA Compliance"
          value={`${metrics.sla_compliance_percentage.toFixed(1)}%`}
          subtitle={cmp ? `vs ${cmp.sla_compliance_percentage.toFixed(1)}% (${delta(metrics.sla_compliance_percentage, cmp.sla_compliance_percentage)}pp)` : "Overall compliance rate"}
          highlight={metrics.sla_compliance_percentage >= 90 ? "green" : "red"}
          onClick={() => pushOutageDrilldown()}
          actionLabel="Open filtered outages"
        />
        <KPICard
          title="Total Penalties"
          value={`$${metrics.penalties.total.toLocaleString()}`}
          subtitle={cmp ? `vs $${cmp.penalties.total.toLocaleString()} (${delta(metrics.penalties.total, cmp.penalties.total)})` : `${metrics.penalties.count} incidents`}
          highlight="red"
          onClick={() => pushPaymentDrilldown("penalty")}
          actionLabel="Open filtered penalty payments"
        />
        <KPICard
          title="Total Rewards"
          value={`$${metrics.rewards.total.toLocaleString()}`}
          subtitle={cmp ? `vs $${cmp.rewards.total.toLocaleString()} (${delta(metrics.rewards.total, cmp.rewards.total)})` : `${metrics.rewards.count} achievements`}
          highlight="green"
          onClick={() => pushPaymentDrilldown("reward")}
          actionLabel="Open filtered reward payments"
        />
        <KPICard
          title="Net Balance"
          value={`${netBalance >= 0 ? "+" : ""}$${netBalance.toLocaleString()}`}
          subtitle={(() => {
            if (!cmp) return "Rewards minus penalties";
            const cmpNet = cmp.rewards.total - cmp.penalties.total;
            return `vs ${cmpNet >= 0 ? "+" : ""}$${cmpNet.toLocaleString()} (${delta(netBalance, cmpNet)})`;
          })()}
          highlight={netBalance >= 0 ? "green" : "red"}
          onClick={() => pushPaymentDrilldown(netBalance >= 0 ? "reward" : "penalty")}
          actionLabel="Open filtered payment drilldown"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SLATrendChart data={metrics.trends} onPointClick={onTrendClick} />
        <PenaltiesRewardsChart data={metrics.trends} onPenaltyClick={onPenaltyClick} onRewardClick={onRewardClick} />
      </div>

      {cmp && cmp.trends.length > 0 ? (
        <div>
          <p className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">Comparison Window</p>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SLATrendChart data={cmp.trends} />
            <PenaltiesRewardsChart data={cmp.trends} />
          </div>
        </div>
      ) : null}

      {compareMode && cmp && cmp.trends.length === 0 ? (
        <p className="rounded-lg bg-yellow-50 px-4 py-2 text-sm text-yellow-700">No data available for the comparison window.</p>
      ) : null}
    </div>
  );
}
