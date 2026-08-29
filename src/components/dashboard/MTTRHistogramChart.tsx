"use client";

// Closes #453: MTTR (Mean Time to Resolution) distribution histogram

import { useMemo, useState, memo } from "react";
import { useQuery } from "@tanstack/react-query";

import { getOutages } from "@/services/outages";
import { buildMttrHistogram } from "@/lib/mttrHistogram";
import { queryKeys } from "@/lib/queryKeys";
import type { Severity } from "@/types/outages";

interface MTTRHistogramChartProps {
  dateFrom?: string;
  dateTo?: string;
}

const SEVERITY_TIERS: Array<{ label: string; value: Severity | "" }> = [
  { label: "All", value: "" },
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];

const MAX_SAMPLE_SIZE = 500;

function MTTRHistogramChart({ dateFrom, dateTo }: MTTRHistogramChartProps) {
  const [severity, setSeverity] = useState<Severity | "">("");

  const params = { status: "resolved", page_size: MAX_SAMPLE_SIZE };
  const query = useQuery({
    queryKey: queryKeys.outages.list(params),
    queryFn: () => getOutages(params),
    staleTime: 30_000,
  });

  const buckets = useMemo(
    () =>
      buildMttrHistogram(query.data?.items ?? [], {
        severity: severity || undefined,
        dateFrom,
        dateTo,
      }),
    [query.data, severity, dateFrom, dateTo],
  );

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const totalCount = buckets.reduce((sum, b) => sum + b.count, 0);

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
          MTTR Distribution
        </h3>
        <div className="flex flex-wrap gap-1">
          {SEVERITY_TIERS.map((tier) => (
            <button
              key={tier.label}
              type="button"
              onClick={() => setSeverity(tier.value)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                severity === tier.value
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}
            >
              {tier.label}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <p className="py-8 text-center text-sm text-slate-400">Loading MTTR distribution…</p>
      ) : query.isError ? (
        <p className="py-8 text-center text-sm text-red-500">Failed to load outage resolution data.</p>
      ) : totalCount === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          No resolved outages match the current filters.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-end gap-3" style={{ height: 140 }}>
            {buckets.map((bucket) => (
              <div key={bucket.key} className="group relative flex flex-1 flex-col items-center justify-end" style={{ height: "100%" }}>
                <span className="mb-1 text-xs font-semibold text-slate-600">{bucket.count}</span>
                <div
                  className="w-full rounded-t bg-blue-400 opacity-80 transition-colors group-hover:opacity-100"
                  style={{ height: `${(bucket.count / maxCount) * 100}%`, minHeight: bucket.count > 0 ? 4 : 0 }}
                />
                <span className="mt-2 text-xs text-slate-500">{bucket.label}</span>
              </div>
            ))}
          </div>
          <p className="text-right text-xs text-slate-400">
            {totalCount} resolved outage{totalCount === 1 ? "" : "s"}
            {severity ? ` · ${severity}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}

export default memo(MTTRHistogramChart);
