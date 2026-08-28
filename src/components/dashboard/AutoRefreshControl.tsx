"use client";

// Closes #454: auto-refresh interval toggle (10s / 30s / 60s / Off) in the dashboard header

import { AUTO_REFRESH_OPTIONS, type AutoRefreshMs } from "@/hooks/useAutoRefresh";

interface AutoRefreshControlProps {
  value: AutoRefreshMs;
  onChange: (value: AutoRefreshMs) => void;
  isTabVisible: boolean;
}

export default function AutoRefreshControl({
  value,
  onChange,
  isTabVisible,
}: AutoRefreshControlProps) {
  const isPolling = value > 0;

  return (
    <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600">
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          isPolling && isTabVisible
            ? "animate-pulse bg-green-500"
            : isPolling && !isTabVisible
              ? "bg-amber-400"
              : "bg-gray-300"
        }`}
        aria-hidden="true"
      />
      <span className="text-xs uppercase tracking-wide text-gray-400">Auto-refresh</span>
      <select
        aria-label="Auto-refresh interval"
        className="rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as AutoRefreshMs)}
      >
        {AUTO_REFRESH_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {isPolling && !isTabVisible ? (
        <span className="text-xs text-amber-500" title="Polling paused while this tab is inactive">
          Paused
        </span>
      ) : null}
    </label>
  );
}
