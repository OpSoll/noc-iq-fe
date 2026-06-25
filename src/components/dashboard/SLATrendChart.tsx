"use client";

import { useState } from "react";
import { TrendPoint } from "../../types/dashboard";
import AnomalyOverlay from "@/components/charts/AnomalyOverlay";
import type { AnomalySegment } from "@/services/analytics";

interface SLATrendChartProps {
  data: TrendPoint[];
  onPointClick?: (point: TrendPoint) => void;
  anomalies?: AnomalySegment[];
}

const clampPercentage = (value: number) => Math.max(0, Math.min(100, value));

const SLATrendChart: React.FC<SLATrendChartProps> = ({
  data,
  onPointClick,
  anomalies = [],
}) => {
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
      <div className="space-y-3">
        {data.length === 0 ? (
          <p className="text-sm text-gray-500">No trend data available.</p>
        ) : (
          <>
            {data.map((point) => (
              <div
                key={point.period}
                className={`space-y-1 ${
                  onPointClick
                    ? "cursor-pointer rounded-lg p-1 hover:bg-gray-50 transition-colors"
                    : ""
                }`}
                onClick={() => onPointClick?.(point)}
                role={onPointClick ? "button" : undefined}
                tabIndex={onPointClick ? 0 : undefined}
                onKeyDown={(e) =>
                  e.key === "Enter" && onPointClick?.(point)
                }
              >
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>{point.period}</span>
                  <span>
                    {clampPercentage(point.compliance_percentage).toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{
                      width: `${clampPercentage(point.compliance_percentage)}%`,
                    }}
                  />
                </div>
              </div>
            ))}

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
};

export default SLATrendChart;
