"use client";

import { useState, useMemo } from "react";

type ErrorBudgetDataPoint = {
  date: string;
  errors: number;
  totalRequests: number;
};

type ThresholdConfig = {
  percent: number;
  windowDays: number;
};

const STORAGE_KEY = "noc_error_budget_config";

const DEFAULT_CONFIG: ThresholdConfig = {
  percent: 99.5,
  windowDays: 30,
};

function loadConfig(): ThresholdConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_CONFIG;
}

function saveConfig(config: ThresholdConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function generateMockData(days: number): ErrorBudgetDataPoint[] {
  const data: ErrorBudgetDataPoint[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const totalRequests = 800 + Math.floor(Math.random() * 400);
    const errors = Math.floor(Math.random() * 15);
    data.push({
      date: d.toISOString().slice(0, 10),
      errors,
      totalRequests,
    });
  }
  return data;
}

function exportBudgetReport(
  data: ErrorBudgetDataPoint[],
  config: ThresholdConfig,
) {
  const totalReqs = data.reduce((sum, d) => sum + d.totalRequests, 0);
  const totalErrs = data.reduce((sum, d) => sum + d.errors, 0);
  const sla = totalReqs > 0 ? ((totalReqs - totalErrs) / totalReqs) * 100 : 100;

  const report = {
    generated_at: new Date().toISOString(),
    window_days: config.windowDays,
    threshold_percent: config.percent,
    summary: {
      total_requests: totalReqs,
      total_errors: totalErrs,
      current_sla: +sla.toFixed(4),
      budget_remaining_pp: +Math.max(0, sla - (100 - config.percent)).toFixed(
        4,
      ),
    },
    daily_data: data,
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `error-budget-report-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ErrorBudgetPage() {
  const [config, setConfig] = useState<ThresholdConfig>(() => loadConfig());
  const [showSettings, setShowSettings] = useState(false);

  const data = useMemo(
    () => generateMockData(config.windowDays),
    [config.windowDays],
  );

  const totalReqs = data.reduce((sum, d) => sum + d.totalRequests, 0);
  const totalErrs = data.reduce((sum, d) => sum + d.errors, 0);
  const currentSla =
    totalReqs > 0 ? ((totalReqs - totalErrs) / totalReqs) * 100 : 100;
  const budgetRemaining = Math.max(0, currentSla - (100 - config.percent));
  const breaches = data.filter(
    (d) =>
      d.totalRequests > 0 &&
      ((d.totalRequests - d.errors) / d.totalRequests) * 100 < config.percent,
  ).length;

  function updateThreshold(percent: number) {
    const next = { ...config, percent };
    setConfig(next);
    saveConfig(next);
  }

  function updateWindow(days: number) {
    const next = { ...config, windowDays: days };
    setConfig(next);
    saveConfig(next);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Error Budget Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Route-level error rates and SLA budget tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Settings
          </button>
          <button
            onClick={() => exportBudgetReport(data, config)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Export Report
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">
            Configuration
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-xs">
              <span className="font-medium text-slate-600">
                SLA Threshold (%)
              </span>
              <input
                type="number"
                min={90}
                max={100}
                step={0.1}
                value={config.percent}
                onChange={(e) =>
                  updateThreshold(parseFloat(e.target.value) || 99.5)
                }
                className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium text-slate-600">Window (days)</span>
              <select
                value={config.windowDays}
                onChange={(e) => updateWindow(parseInt(e.target.value, 10))}
                className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {[7, 14, 30, 60, 90].map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Thresholds are stored in localStorage and persist across sessions.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs text-slate-500">Current SLA</p>
          <p
            className={`mt-1 text-3xl font-bold ${currentSla >= config.percent ? "text-green-600" : "text-red-600"}`}
          >
            {currentSla.toFixed(2)}%
          </p>
          <p className="text-xs text-slate-400">threshold: {config.percent}%</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs text-slate-500">Budget Remaining</p>
          <p
            className={`mt-1 text-3xl font-bold ${budgetRemaining > 0 ? "text-green-600" : "text-red-600"}`}
          >
            {budgetRemaining.toFixed(2)}pp
          </p>
          <p className="text-xs text-slate-400">
            of {(100 - config.percent).toFixed(1)}pp allowed
          </p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs text-slate-500">Total Requests</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">
            {totalReqs.toLocaleString()}
          </p>
          <p className="text-xs text-slate-400">
            over {config.windowDays} days
          </p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs text-slate-500">Threshold Breaches</p>
          <p
            className={`mt-1 text-3xl font-bold ${breaches === 0 ? "text-green-600" : "text-red-600"}`}
          >
            {breaches}
          </p>
          <p className="text-xs text-slate-400">of {config.windowDays} days</p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">
          Daily Error Rate Trend
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2 text-right">Requests</th>
                <th className="px-3 py-2 text-right">Errors</th>
                <th className="px-3 py-2 text-right">SLA %</th>
                <th className="px-3 py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.slice(-14).map((d) => {
                const sla =
                  d.totalRequests > 0
                    ? ((d.totalRequests - d.errors) / d.totalRequests) * 100
                    : 100;
                const passed = sla >= config.percent;
                return (
                  <tr key={d.date} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-700">
                      {d.date}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {d.totalRequests.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {d.errors}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium ${passed ? "text-green-600" : "text-red-600"}`}
                    >
                      {sla.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${passed ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                      >
                        {passed ? "OK" : "BREACH"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data.length > 14 && (
          <p className="mt-2 text-xs text-slate-400">
            Showing last 14 of {data.length} days. Export full report for all
            data.
          </p>
        )}
      </div>
    </div>
  );
}
