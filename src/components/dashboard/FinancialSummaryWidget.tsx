"use client";

// Closes #452: SLA penalty and reward aggregate financial widget

import { useMemo, memo } from "react";

import { aggregateMonthlyNet, computeFinancialTotals } from "@/lib/financialSummary";
import type { MonthlyNetPoint } from "@/lib/financialSummary";
import type { DashboardMetrics } from "@/types/dashboard";

interface FinancialSummaryWidgetProps {
  metrics: DashboardMetrics;
}

const formatAmount = (value: number) =>
  `${value < 0 ? "-" : ""}$${Math.abs(value).toLocaleString()}`;

/** Minimal inline sparkline — no charting library, matches the rest of the dashboard's custom charts. */
function NetBalanceSparkline({ points }: { points: MonthlyNetPoint[] }) {
  if (points.length === 0) {
    return <p className="text-xs text-slate-400">No monthly history yet.</p>;
  }

  const width = 280;
  const height = 48;
  const values = points.map((p) => p.net);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;

  const stepX = points.length > 1 ? width / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = points.length > 1 ? i * stepX : width / 2;
    const y = height - ((p.net - min) / range) * height;
    return { x, y, ...p };
  });
  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const zeroY = height - ((0 - min) / range) * height;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-12 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Monthly net settlement balance sparkline"
      >
        <line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke="#e2e8f0" strokeWidth={1} />
        <polyline points={polylinePoints} fill="none" stroke="#3b82f6" strokeWidth={2} />
        {coords.map((c) => (
          <circle
            key={c.monthKey}
            cx={c.x}
            cy={c.y}
            r={2.5}
            fill={c.net >= 0 ? "#16a34a" : "#dc2626"}
          >
            <title>
              {c.label}: {formatAmount(c.net)}
            </title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{points[0].label}</span>
        {points.length > 1 && <span>{points[points.length - 1].label}</span>}
      </div>
    </div>
  );
}

function FinancialSummaryWidget({ metrics }: FinancialSummaryWidgetProps) {
  const totals = useMemo(() => computeFinancialTotals(metrics), [metrics]);
  const monthly = useMemo(() => aggregateMonthlyNet(metrics.trends), [metrics.trends]);

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-gray-600 uppercase tracking-wide">
        SLA Penalty &amp; Reward Settlement
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-red-100 bg-red-50 p-3">
          <p className="text-xs font-medium text-red-600">Total Penalties</p>
          <p className="mt-1 text-xl font-bold text-red-700">
            {formatAmount(totals.totalPenalties)}
          </p>
          <p className="text-[11px] text-red-500">Settled in XLM</p>
        </div>
        <div className="rounded-lg border border-green-100 bg-green-50 p-3">
          <p className="text-xs font-medium text-green-600">Total Rewards</p>
          <p className="mt-1 text-xl font-bold text-green-700">
            {formatAmount(totals.totalRewards)}
          </p>
          <p className="text-[11px] text-green-500">Credited in XLM</p>
        </div>
        <div
          className={`rounded-lg border p-3 ${
            totals.netSettlement >= 0
              ? "border-blue-100 bg-blue-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <p
            className={`text-xs font-medium ${
              totals.netSettlement >= 0 ? "text-blue-600" : "text-amber-600"
            }`}
          >
            Net Settlement Balance
          </p>
          <p
            className={`mt-1 text-xl font-bold ${
              totals.netSettlement >= 0 ? "text-blue-700" : "text-amber-700"
            }`}
          >
            {formatAmount(totals.netSettlement)}
          </p>
          <p
            className={`text-[11px] ${
              totals.netSettlement >= 0 ? "text-blue-500" : "text-amber-600"
            }`}
          >
            Rewards minus penalties
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="mb-2 text-xs font-medium text-slate-500">
          Monthly Net Balance History
        </p>
        <NetBalanceSparkline points={monthly} />
      </div>
    </div>
  );
}

export default memo(FinancialSummaryWidget);
