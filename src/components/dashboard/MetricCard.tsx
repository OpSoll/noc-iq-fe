'use client';

/**
 * MetricCard — a single dashboard metric with its trend indicator
 * (closes #600).
 *
 * Purely presentational: it receives an already-formatted value and an already
 * resolved trend, so the direction maths stays in `@/lib/mttrMtbf` where it can
 * be unit tested without rendering anything. The colour is never the only
 * signal — every card also renders the trend as text, so "green means better"
 * is not the sole carrier of meaning (WCAG 2.1 SC 1.4.1).
 */

import type { MetricTrend } from '@/lib/mttrMtbf';

export interface MetricCardProps {
  title: string;
  /** Formatted metric value, e.g. `2h 15m`. */
  value: string;
  /** Signed percentage change, or null when there is no baseline. */
  changePercentage: number | null;
  /** Trend already resolved against the metric's polarity. */
  trend: MetricTrend;
  /** Formatted comparison line, e.g. `+12.0% vs previous cycle`. */
  comparison: string;
  /** One-line explanation of what the metric means. */
  detail?: string;
}

const TREND_STYLES: Record<MetricTrend, { text: string; label: string }> = {
  improving: { text: 'text-green-700', label: 'Improving' },
  degrading: { text: 'text-red-700', label: 'Degrading' },
  flat: { text: 'text-gray-500', label: 'Unchanged' },
  unknown: { text: 'text-gray-400', label: 'No comparison' },
};

/** Arrow for the raw movement, which may point the "worse" way. */
function trendArrow(changePercentage: number | null): string {
  if (changePercentage === null || !Number.isFinite(changePercentage)) {
    return '—';
  }
  if (changePercentage > 0) return '▲';
  if (changePercentage < 0) return '▼';
  return '—';
}

export default function MetricCard({
  title,
  value,
  changePercentage,
  trend,
  comparison,
  detail,
}: MetricCardProps) {
  const style = TREND_STYLES[trend];
  const arrow = trendArrow(changePercentage);

  return (
    <div
      data-testid="metric-card"
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <p className="text-sm font-medium text-gray-500">{title}</p>

      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <p className="text-3xl font-bold tabular-nums text-gray-800">{value}</p>
        <span
          data-testid="metric-trend"
          data-trend={trend}
          className={`flex items-center gap-1 text-sm font-semibold ${style.text}`}
        >
          <span aria-hidden="true">{arrow}</span>
          {style.label}
        </span>
      </div>

      <p className={`mt-2 text-xs ${style.text}`}>{comparison}</p>

      {detail ? <p className="mt-1 text-xs text-gray-400">{detail}</p> : null}
    </div>
  );
}
