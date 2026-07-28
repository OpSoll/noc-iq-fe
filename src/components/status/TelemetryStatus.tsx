"use client";

import React, { useMemo } from "react";
import type { TelemetryHealthManager } from "@/lib/telemetry/health";

interface TelemetryStatusProps {
  manager: TelemetryHealthManager;
  refreshInterval?: number;
}

const stateColor: Record<string, string> = {
  normal: "bg-green-100 text-green-800",
  degraded: "bg-yellow-100 text-yellow-800",
  disabled: "bg-gray-100 text-gray-500",
};

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSec = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainSec}s`;
  const hours = Math.floor(minutes / 60);
  const remainMin = minutes % 60;
  return `${hours}h ${remainMin}m`;
}

export default function TelemetryStatus({
  manager,
  refreshInterval = 2000,
}: TelemetryStatusProps) {
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), refreshInterval);
    return () => clearInterval(id);
  }, [refreshInterval]);

  const state = useMemo(() => manager.getState(), [manager]);
  const metrics = useMemo(() => manager.getMetrics(), [manager]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">Telemetry Health</h2>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">State</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${stateColor[state]}`}>
            {state}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Events emitted</span>
          <span className="text-sm font-medium text-gray-900">{metrics.totalEmitted}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Events dropped</span>
          <span className={`text-sm font-medium ${metrics.totalDropped > 0 ? "text-red-600" : "text-gray-900"}`}>
            {metrics.totalDropped}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Drop rate</span>
          <span className="text-sm font-medium text-gray-900">
            {(metrics.dropRate * 100).toFixed(1)}%
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Uptime</span>
          <span className="text-sm font-medium text-gray-900">{formatUptime(metrics.uptimeMs)}</span>
        </div>
      </div>
    </div>
  );
}
