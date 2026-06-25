import React from "react";
import type { KPIConfidence } from "@/services/analytics";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  highlight?: "green" | "red" | "blue" | "yellow";
  confidence?: KPIConfidence;
}

const highlightMap: Record<string, string> = {
  green: "border-green-500 bg-green-50",
  red: "border-red-500 bg-red-50",
  blue: "border-blue-500 bg-blue-50",
  yellow: "border-yellow-500 bg-yellow-50",
};

const valueColorMap: Record<string, string> = {
  green: "text-green-700",
  red: "text-red-700",
  blue: "text-blue-700",
  yellow: "text-yellow-700",
};

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  highlight = "blue",
  confidence,
}) => {
  return (
    <div
      className={`rounded-xl border-l-4 p-5 shadow-sm ${highlightMap[highlight]}`}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        {confidence && (
          <div className="flex flex-col items-end gap-0.5">
            <span
              className={`text-xs font-medium ${
                confidence.isSparse ? "text-amber-500" : "text-gray-400"
              }`}
              title={confidence.warning}
            >
              {confidence.confidence}% conf.
            </span>
            <span className="text-[10px] text-gray-400">
              n={confidence.sampleSize}
            </span>
          </div>
        )}
      </div>
      <p className={`mt-1 text-3xl font-bold ${valueColorMap[highlight]}`}>
        {value}
      </p>
      {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
      {confidence?.warning && (
        <p className="mt-1 text-xs text-amber-500">{confidence.warning}</p>
      )}
    </div>
  );
};

export default KPICard;
