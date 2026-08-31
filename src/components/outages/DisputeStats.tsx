"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDisputes } from "@/services/sla";
import type { DisputeStatus, SLADispute } from "@/types/sla";

import {
  computeDisputeKpis,
  computeMonthlyTrend,
  type MonthlyTrendPoint,
} from "./disputeStats";

const TREND_BAR_HEIGHT = 96;

interface Props {
  outageId: string;
  statusFilter: DisputeStatus | "";
}

function TrendChart({ points }: { points: MonthlyTrendPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.count));

  return (
    <div>
      {points.length === 0 ? (
        <p className="text-xs text-slate-400">No dispute activity yet.</p>
      ) : (
        <svg
          width={300}
          height={TREND_BAR_HEIGHT + 24}
          role="img"
          aria-label="Monthly dispute trend"
        >
          <title>Monthly dispute trend</title>
          {points.map((p, i) => {
            const barHeight = Math.max(2, (p.count / max) * TREND_BAR_HEIGHT);
            const x = i * 46;
            return (
              <g key={p.month}>
                <rect
                  x={x + 8}
                  y={TREND_BAR_HEIGHT - barHeight}
                  width={30}
                  height={barHeight}
                  fill="currentColor"
                  className="text-slate-700"
                />
                <text
                  x={x + 23}
                  y={TREND_BAR_HEIGHT + 14}
                  textAnchor="middle"
                  className="fill-slate-400"
                  fontSize={9}
                >
                  {p.label.split(" ")[0]}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/**
 * High-level dispute metrics for management: total disputes, pending
 * approvals, approval rate, average resolution time, and a monthly trend.
 * Metrics recompute whenever the surrounding status filter changes because
 * the query key includes the filter.
 */
export function DisputeStats({ outageId, statusFilter }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["sla-disputes-stats", outageId, statusFilter],
    queryFn: () =>
      getDisputes({
        outage_id: outageId,
        status: statusFilter || undefined,
        page: 1,
        page_size: 200,
      }),
    staleTime: 30_000,
    enabled: Boolean(outageId),
  });

  const disputes = useMemo<SLADispute[]>(() => data?.items ?? [], [data]);

  const kpis = useMemo(() => computeDisputeKpis(disputes), [disputes]);
  const trend = useMemo(() => computeMonthlyTrend(disputes), [disputes]);

  const cards: Array<{ label: string; value: string; hint?: string }> = [
    { label: "Total Disputes", value: String(kpis.total) },
    {
      label: "Pending Approval",
      value: String(kpis.pendingApproval),
      hint: "open + under review",
    },
    {
      label: "Approval Rate",
      value: kpis.total === 0 ? "—" : `${kpis.approvalRatePct}%`,
      hint: "resolved of decided",
    },
    {
      label: "Avg Resolution Time",
      value: kpis.avgResolutionHours === null ? "—" : `${kpis.avgResolutionHours}h`,
      hint: kpis.avgResolutionHours === null ? "no resolutions yet" : undefined,
    },
  ];

  return (
    <Card>
      <CardHeader className="space-y-1 pb-3">
        <CardTitle>Dispute statistics</CardTitle>
        <p className="text-sm text-slate-500">
          Volume and resolution efficiency{statusFilter ? ` — filtered by ${statusFilter.replace("_", " ")}` : ""}.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-lg border border-slate-100 p-4"
              >
                <div className="h-3 w-20 rounded bg-slate-200" />
                <div className="mt-2 h-6 w-10 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <p className="text-xs text-red-600">Failed to load dispute statistics.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {cards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <p className="text-xs font-medium text-slate-500">
                    {card.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {card.value}
                  </p>
                  {card.hint ? (
                    <p className="mt-1 text-[11px] text-slate-400">{card.hint}</p>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Monthly dispute trend
              </p>
              <TrendChart points={trend} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
