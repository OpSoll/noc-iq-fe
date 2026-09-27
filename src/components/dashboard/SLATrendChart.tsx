'use client';

/**
 * SLATrendChart
 *
 * Hand-rolled SLA compliance trend: one progress row per data point, plus the
 * dashed target line. Colours come from the shared chart theme so labels,
 * target line and above/below-target fills stay above the WCAG contrast floors
 * in light and dark mode.
 *
 * Closes #608 – Dashboard: dark mode colour contrast optimization for charts
 */

import { useMemo, useRef, useState, memo } from 'react';
import { TrendPoint } from '../../types/dashboard';
import AnomalyOverlay from '@/components/charts/AnomalyOverlay';
import { useChartTheme } from '@/components/charts/useChartTheme';
import type { AnomalySegment } from '@/services/analytics';
import {
  DEFAULT_SLA_COMPLIANCE_TARGET,
  formatComplianceVariance,
  isAboveTarget,
} from '@/lib/slaTarget';

interface SLATrendChartProps {
  data: TrendPoint[];
  onPointClick?: (point: TrendPoint) => void;
  anomalies?: AnomalySegment[];
  /** Operational SLA compliance target percentage. Closes #449. */
  target?: number;
  /** Human-readable date range shown in the chart's accessible label. Closes #447. */
  dateRangeLabel?: string;
}

const clampPercentage = (value: number) => Math.max(0, Math.min(100, value));

function SLATrendChart({
  data,
  onPointClick,
  anomalies = [],
  target = DEFAULT_SLA_COMPLIANCE_TARGET,
  dateRangeLabel,
}: SLATrendChartProps) {
  const [showAnomalies, setShowAnomalies] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const { theme } = useChartTheme();

  const chartLabel = useMemo(() => {
    const rangePart = dateRangeLabel ? ` for ${dateRangeLabel}` : '';
    if (data.length === 0) {
      return `SLA compliance trend chart${rangePart}. No data points.`;
    }
    const latest = data[data.length - 1];
    return `SLA compliance trend chart${rangePart} with ${data.length} data point${
      data.length === 1 ? '' : 's'
    }. Latest: ${clampPercentage(latest.compliance_percentage).toFixed(1)}% against a ${target}% target. Use the arrow keys to move between points.`;
  }, [data, dateRangeLabel, target]);

  function focusIndex(nextIndex: number) {
    if (data.length === 0) return;
    const clamped = Math.max(0, Math.min(data.length - 1, nextIndex));
    setFocusedIndex(clamped);
    itemRefs.current[clamped]?.focus();
  }

  function handlePointKeyDown(
    e: React.KeyboardEvent<HTMLDivElement>,
    index: number
  ) {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        focusIndex(index + 1);
        return;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        focusIndex(index - 1);
        return;
      case 'Home':
        e.preventDefault();
        focusIndex(0);
        return;
      case 'End':
        e.preventDefault();
        focusIndex(data.length - 1);
        return;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onPointClick?.(data[index]);
        return;
      default:
        return;
    }
  }

  return (
    <div
      className="rounded-xl p-5 shadow-sm"
      style={{ backgroundColor: theme.surface, color: theme.axisLabel }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3
          className="text-sm font-semibold uppercase tracking-wide"
          style={{ color: theme.axisLabel }}
        >
          SLA Compliance Trend
        </h3>
        {anomalies.length > 0 && (
          <button
            onClick={() => setShowAnomalies((v) => !v)}
            className={`rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${
              showAnomalies
                ? 'border-red-300 bg-red-50 text-red-700'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {showAnomalies
              ? 'Hide anomalies'
              : `Anomalies (${anomalies.length})`}
          </button>
        )}
      </div>

      {data.length > 0 && (
        <div
          className="mb-2 flex items-center gap-1.5 text-[11px]"
          style={{ color: theme.muted }}
        >
          <span
            className="inline-block h-0 w-3 border-t-2 border-dashed"
            style={{ borderColor: theme.gridLine }}
            aria-hidden="true"
          />
          <span>Target {target}%</span>
        </div>
      )}

      {/* Accessible focus container: role="group" describes the chart as a
          whole; roving tabIndex below keeps Tab from stopping on every row
          while arrow keys move a single focus point between them. Closes #447. */}
      <div className="space-y-3" role="group" aria-label={chartLabel}>
        {data.length === 0 ? (
          <p className="text-sm" style={{ color: theme.muted }}>
            No trend data available.
          </p>
        ) : (
          <>
            {data.map((point, index) => {
              const pct = clampPercentage(point.compliance_percentage);
              const above = isAboveTarget(pct, target);
              const variance = formatComplianceVariance(pct, target);
              const pointLabel = `${point.period}: ${pct.toFixed(1)}% compliance, ${variance}`;

              return (
                <div
                  key={point.period}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  className={`space-y-1 ${
                    onPointClick
                      ? 'cursor-pointer rounded-lg p-1 transition-colors hover:bg-gray-50'
                      : 'rounded-lg p-1'
                  } focus:outline-none focus:ring-2 focus:ring-blue-400`}
                  onClick={() => onPointClick?.(point)}
                  role={onPointClick ? 'button' : 'img'}
                  aria-label={pointLabel}
                  title={variance}
                  tabIndex={index === focusedIndex ? 0 : -1}
                  onFocus={() => setFocusedIndex(index)}
                  onKeyDown={(e) => handlePointKeyDown(e, index)}
                >
                  <div
                    className="flex items-center justify-between text-sm"
                    style={{ color: theme.axisLabel }}
                  >
                    <span>{point.period}</span>
                    <span>{pct.toFixed(1)}%</span>
                  </div>
                  <div
                    className="relative h-3 overflow-hidden rounded-full"
                    style={{ backgroundColor: theme.track }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: above
                          ? theme.positive
                          : theme.negative,
                      }}
                    />
                    <div
                      className="absolute inset-y-0 border-l-2 border-dashed"
                      style={{
                        left: `${clampPercentage(target)}%`,
                        borderColor: theme.gridLine,
                      }}
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
