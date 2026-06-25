"use client";

import { useMemo } from "react";

interface AriaSummaryProps {
  title: string;
  description: string;
  stats?: Array<{ label: string; value: string | number }>;
  filters?: Record<string, string | undefined>;
  live?: boolean;
}

export function AriaSummary({
  title,
  description,
  stats,
  filters,
  live = true,
}: AriaSummaryProps) {
  const summaryText = useMemo(() => {
    const parts = [title, description];

    if (stats && stats.length > 0) {
      const statsText = stats.map((s) => `${s.label}: ${s.value}`).join(". ");
      parts.push(statsText);
    }

    if (filters) {
      const activeFilters = Object.entries(filters).filter(
        ([, v]) => v !== undefined && v !== "",
      );
      if (activeFilters.length > 0) {
        const filterText = activeFilters
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
        parts.push(`Active filters: ${filterText}`);
      }
    }

    return parts.join(". ");
  }, [title, description, stats, filters]);

  const ariaProps = live
    ? { "aria-live": "polite" as const, "aria-atomic": true as const }
    : {};

  return (
    <div
      role="status"
      className="sr-only"
      {...ariaProps}
    >
      {summaryText}
    </div>
  );
}

export function ChartSummary({
  label,
  dataPoints,
}: {
  label: string;
  dataPoints: Array<{ label: string; value: string | number }>;
}) {
  const summary = useMemo(() => {
    const points = dataPoints
      .map((p) => `${p.label}: ${p.value}`)
      .join(". ");
    return `${label}. ${points}`;
  }, [label, dataPoints]);

  return (
    <div role="img" aria-label={summary} className="sr-only">
      {summary}
    </div>
  );
}

export function TableSummary({
  name,
  rowCount,
  columnCount,
  selectionCount,
}: {
  name: string;
  rowCount: number;
  columnCount: number;
  selectionCount?: number;
}) {
  const summary = useMemo(() => {
    const parts = [`${name} table with ${rowCount} rows and ${columnCount} columns`];
    if (selectionCount !== undefined && selectionCount > 0) {
      parts.push(`${selectionCount} rows selected`);
    }
    return parts.join(". ");
  }, [name, rowCount, columnCount, selectionCount]);

  return (
    <div aria-label={summary} role="region" className="sr-only">
      {summary}
    </div>
  );
}
