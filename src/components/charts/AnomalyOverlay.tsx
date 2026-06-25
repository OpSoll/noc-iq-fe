"use client";

import { useState } from "react";
import type { AnomalySegment } from "@/services/analytics";

interface AnomalyOverlayProps {
  anomalies: AnomalySegment[];
  visible: boolean;
  onToggle: () => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-yellow-100 border-yellow-300",
  medium: "bg-orange-100 border-orange-300",
  high: "bg-red-100 border-red-300",
};

const SEVERITY_DOT: Record<string, string> = {
  low: "bg-yellow-400",
  medium: "bg-orange-400",
  high: "bg-red-500",
};

export default function AnomalyOverlay({
  anomalies,
  visible,
  onToggle,
}: AnomalyOverlayProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!visible) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Anomaly Highlights ({anomalies.length})
        </h4>
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={visible}
            onChange={onToggle}
            className="rounded"
          />
          Show overlays
        </label>
      </div>
      <div className="space-y-1.5">
        {anomalies.map((anomaly, idx) => (
          <div
            key={idx}
            className={`rounded-lg border p-3 text-xs transition-colors ${
              SEVERITY_COLORS[anomaly.severity] ?? "bg-gray-50 border-gray-200"
            }`}
          >
            <button
              className="flex w-full items-center justify-between gap-2 text-left"
              onClick={() =>
                setExpanded(expanded === `${idx}` ? null : `${idx}`)
              }
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    SEVERITY_DOT[anomaly.severity] ?? "bg-gray-400"
                  }`}
                />
                <span className="font-medium text-slate-700">
                  {anomaly.period}
                </span>
                <span className="text-slate-500">{anomaly.metric}</span>
              </div>
              <span
                className={`font-mono font-medium ${
                  anomaly.deviation > 0 ? "text-red-600" : "text-green-600"
                }`}
              >
                {anomaly.deviation > 0 ? "+" : ""}
                {anomaly.deviation.toFixed(1)}%
              </span>
            </button>
            {expanded === `${idx}` && (
              <div className="mt-2 space-y-1 border-t border-current border-opacity-20 pt-2 text-slate-600">
                <p>
                  Expected: {anomaly.expected.toLocaleString()} | Actual:{" "}
                  {anomaly.actual.toLocaleString()}
                </p>
                <p className="italic">{anomaly.note}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
