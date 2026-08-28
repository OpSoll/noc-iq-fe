"use client";

import { useMemo, memo } from "react";

export interface ErrorBudgetDataPoint {
  date: string;
  errors: number;
  totalRequests: number;
}

interface ErrorBudgetChartProps {
  data: ErrorBudgetDataPoint[];
  thresholdPercent?: number;
  windowLabel?: string;
}

function ErrorBudgetChart({
  data,
  thresholdPercent = 99.5,
  windowLabel = "30d",
}: ErrorBudgetChartProps) {
  const chartBars = useMemo(() => {
    if (data.length === 0) return [];
    const maxRequests = Math.max(...data.map((d) => d.totalRequests), 1);
    return data.map((d) => ({
      ...d,
      errorRate: d.totalRequests > 0 ? ((d.totalRequests - d.errors) / d.totalRequests) * 100 : 100,
      heightPercent: (d.totalRequests / maxRequests) * 100,
      isError: d.totalRequests > 0 && ((d.totalRequests - d.errors) / d.totalRequests) * 100 < thresholdPercent,
    }));
  }, [data, thresholdPercent]);

  const overallErrorRate = useMemo(() => {
    const totalReqs = data.reduce((sum, d) => sum + d.totalRequests, 0);
    const totalErrs = data.reduce((sum, d) => sum + d.errors, 0);
    if (totalReqs === 0) return 100;
    return ((totalReqs - totalErrs) / totalReqs) * 100;
  }, [data]);

  const budgetRemaining = Math.max(0, overallErrorRate - (100 - thresholdPercent));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          Error Budget Trend ({windowLabel})
        </h3>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-green-400" /> Healthy
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-red-400" /> Breach
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="text-center">
          <p className="text-xs text-slate-500">Current SLA</p>
          <p className={`text-lg font-bold ${overallErrorRate >= thresholdPercent ? "text-green-600" : "text-red-600"}`}>
            {overallErrorRate.toFixed(2)}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500">Threshold</p>
          <p className="text-lg font-bold text-slate-800">{thresholdPercent}%</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500">Budget Remaining</p>
          <p className={`text-lg font-bold ${budgetRemaining > 0 ? "text-green-600" : "text-red-600"}`}>
            {budgetRemaining.toFixed(2)}pp
          </p>
        </div>
      </div>

      {chartBars.length > 0 ? (
        <div className="flex items-end gap-1" style={{ height: 120 }}>
          {chartBars.map((bar, idx) => (
            <div key={idx} className="group relative flex-1" style={{ height: "100%" }}>
              <div className="absolute bottom-0 w-full" style={{ height: `${bar.heightPercent}%` }}>
                <div
                  className={`h-full w-full rounded-t transition-colors ${
                    bar.isError ? "bg-red-400" : "bg-green-400"
                  } opacity-80 hover:opacity-100`}
                />
              </div>
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white shadow group-hover:block">
                {bar.date}: {bar.errorRate.toFixed(2)}% SLA ({bar.errors}/{bar.totalRequests} errors)
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-slate-400">No data available for this window.</p>
      )}

      {chartBars.length > 0 && (
        <p className="text-right text-xs text-slate-400">
          Threshold line: {thresholdPercent}% SLA
        </p>
      )}
    </div>
  );
}

export default memo(ErrorBudgetChart);