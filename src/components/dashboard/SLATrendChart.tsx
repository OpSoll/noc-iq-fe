"use client";

import { useState, memo } from "react";
import { TrendPoint } from "../../types/dashboard";
import AnomalyOverlay from "@/components/charts/AnomalyOverlay";
import type { AnomalySegment } from "@/services/analytics";
import {
  DEFAULT_SLA_COMPLIANCE_TARGET,
  formatComplianceVariance,
  isAboveTarget,
} from "@/lib/slaTarget";

interface SLATrendChartProps {
  data: TrendPoint[];
  onPointClick?: (point: TrendPoint) => void;
  anomalies?: AnomalySegment[];
  /** Operational SLA compliance target percentage. Closes #449. */
  target?: number;
}

const clampPercentage = (value: number) => Math.max(0, Math.min(100, value));

function SLATrendChart({
  data,
  onPointClick,
  anomalies = [],
  target = DEFAULT_SLA_COMPLIANCE_TARGET,
}: SLATrendChartProps) {
  const [showAnomalies, setShowAnomalies] = useState(false);

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
          SLA Compliance Trend
        </h3>
        {anomalies.length > 0 && (
          <button
            onClick={() => setShowAnomalies((v) => !v)}
            className={`rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${
              showAnomalies
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            {showAnomalies ? "Hide anomalies" : `Anomalies (${anomalies.length})`}
          </button>
        )}
      </div>

      {data.length > 0 && (
        <div className="mb-2 flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="inline-block h-0 w-3 border-t-2 border-dashed border-slate-500" aria-hidden="true" />
          <span>Target {target}%</span>
        </div>
      )}

      <div className="space-y-3">
        {data.length === 0 ? (
          <p className="text-sm text-gray-500">No trend data available.</p>
        ) : (
          <>
            {data.map((point) => {
              const pct = clampPercentage(point.compliance_percentage);
              const above = isAboveTarget(pct, target);
              const variance = formatComplianceVariance(pct, target);

              return (
                <div
                  key={point.period}
                  className={`space-y-1 ${
                    onPointClick
                      ? "cursor-pointer rounded-lg p-1 hover:bg-gray-50 transition-colors"
                      : ""
                  }`}
                  onClick={() => onPointClick?.(point)}
                  role={onPointClick ? "button" : undefined}
                  title={variance}
                  tabIndex={onPointClick ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPointClick?.(point);
                    }
                  }}
                >
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>{point.period}</span>
                    <span>{pct.toFixed(1)}%</span>
                  </div>
                  <div className="relative h-3 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        above ? "bg-green-500" : "bg-red-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                    <div
                      className="absolute inset-y-0 border-l-2 border-dashed border-slate-500"
                      style={{ left: `${clampPercentage(target)}%` }}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              );
            })}

            {anomalies.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <AnomalyOverlay
                  anomalies={anomalies}
                  visible={showAnomalies}
                  onToggle={() => setShowAnomalies((v) => !v)}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default memo(SLATrendChart);
