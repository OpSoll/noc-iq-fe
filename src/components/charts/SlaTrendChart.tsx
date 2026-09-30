'use client';

/**
 * SlaTrendChart — SLA compliance history over 7 / 30 / 90 days
 * (closes #603).
 *
 * Plots daily availability as a filled area against the SLA target threshold
 * line. Each point carries the day's outage count and downtime duration in its
 * tooltip, so a dip can be traced to the incidents behind it without leaving
 * the chart.
 *
 * The y-axis is deliberately zoomed to the observed range rather than spanning
 * 0-100: availability lives in a narrow band near the target, and a full-range
 * axis would render every real movement as a flat line. `computeTrendScale`
 * keeps the target inside the domain so the threshold line is always visible.
 *
 * Hand-rolled SVG, consistent with the rest of the charts in this repo.
 */

import { memo, useMemo, useState } from 'react';

import type { Outage } from '@/types/outages';
import { DEFAULT_SLA_COMPLIANCE_TARGET } from '@/lib/slaTarget';
import {
  TREND_WINDOW_KEYS,
  buildSlaTrendSeries,
  computeTrendScale,
  resolveTrendWindow,
  scaleX,
  scaleY,
  sliceTrendSeries,
  trendAreaPath,
  type SlaTrendDatum,
  type TrendWindowKey,
} from '@/lib/slaTrendSeries';

const WIDTH = 480;
const HEIGHT = 160;
const MARGIN = { top: 8, right: 8, bottom: 8, left: 8 };

export interface SlaTrendChartProps {
  /** Outages backing the series. */
  outages: Outage[];
  /** Measured range; defaults to the trailing 30 days. */
  dateFrom?: string;
  dateTo?: string;
  targetPercentage?: number;
  className?: string;
}

function SlaTrendChart({
  outages,
  dateFrom,
  dateTo,
  targetPercentage = DEFAULT_SLA_COMPLIANCE_TARGET,
  className,
}: SlaTrendChartProps) {
  const [windowKey, setWindowKey] = useState<TrendWindowKey>('30d');

  const series = useMemo(
    () => buildSlaTrendSeries(outages, resolveTrendWindow(dateFrom, dateTo)),
    [outages, dateFrom, dateTo]
  );

  const visible = useMemo(
    () => sliceTrendSeries(series, windowKey),
    [series, windowKey]
  );

  const scale = useMemo(
    () => computeTrendScale(visible, targetPercentage),
    [visible, targetPercentage]
  );

  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

  const areaPath = trendAreaPath(visible, scale, plotWidth, plotHeight);
  const targetY = scaleY(targetPercentage, scale, plotHeight);

  const averageAvailability = visible.length
    ? visible.reduce((sum, d) => sum + d.availabilityPercentage, 0) /
      visible.length
    : 0;

  const worstPoint = visible.reduce<SlaTrendDatum | null>(
    (worst, point) =>
      worst === null ||
      point.availabilityPercentage < worst.availabilityPercentage
        ? point
        : worst,
    null
  );

  const accessibleLabel = visible.length
    ? `SLA compliance over the last ${windowKey}. Average ${averageAvailability.toFixed(3)}% ` +
      `against a ${targetPercentage}% target; worst day ${worstPoint?.date} at ` +
      `${worstPoint?.availabilityPercentage.toFixed(3)}%.`
    : `No SLA compliance data for the last ${windowKey}.`;

  return (
    <section
      data-testid="sla-trend-chart"
      aria-labelledby="sla-trend-heading"
      className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${className ?? ''}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3
          id="sla-trend-heading"
          className="text-sm font-semibold text-gray-600 uppercase tracking-wide"
        >
          SLA Compliance History
        </h3>
        <div
          className="flex gap-1 text-xs"
          role="group"
          aria-label="Chart timeframe"
        >
          {TREND_WINDOW_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setWindowKey(key)}
              aria-pressed={windowKey === key}
              className={`rounded-full px-3 py-1 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                windowKey === key
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {key.replace('d', ' days')}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">
          No compliance history for this range.
        </p>
      ) : (
        <>
          <svg
            className="mt-3 w-full"
            viewBox={`${-MARGIN.left} ${-MARGIN.top} ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label={accessibleLabel}
            preserveAspectRatio="none"
          >
            <title>{accessibleLabel}</title>

            {/* Target SLA threshold line. */}
            <line
              x1={0}
              x2={plotWidth}
              y1={targetY}
              y2={targetY}
              stroke="#b45309"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              data-testid="sla-trend-target-line"
            />

            <path
              d={areaPath}
              fill="#2563eb"
              fillOpacity={0.15}
              stroke="#2563eb"
              strokeWidth={2}
              data-testid="sla-trend-area"
            />

            {visible.map((point, index) => (
              <g
                key={point.date}
                className="group"
                data-testid="sla-trend-point"
              >
                <circle
                  cx={scaleX(index, visible.length, plotWidth)}
                  cy={scaleY(point.availabilityPercentage, scale, plotHeight)}
                  r={2.5}
                  fill="#2563eb"
                />
                {/* Generous invisible hit area so the tooltip is reachable. */}
                <rect
                  x={scaleX(index, visible.length, plotWidth) - 6}
                  y={0}
                  width={12}
                  height={plotHeight}
                  fill="transparent"
                >
                  <title>
                    {`${point.date}: ${point.availabilityPercentage.toFixed(3)}% availability, ` +
                      `${point.outageCount} outage${point.outageCount === 1 ? '' : 's'}, ` +
                      `${point.downtimeMinutes.toFixed(1)}m downtime`}
                  </title>
                </rect>
              </g>
            ))}
          </svg>

          {/*
            The same series as an accessible table. Screen readers get the
            per-day detail the SVG only exposes on hover, and it doubles as the
            assertion surface for the tooltip content in tests.
          */}
          <table className="sr-only" data-testid="sla-trend-table">
            <caption>{accessibleLabel}</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Availability</th>
                <th scope="col">Outages</th>
                <th scope="col">Downtime (min)</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((point) => (
                <tr key={point.date} data-testid="sla-trend-row">
                  <th scope="row">{point.date}</th>
                  <td>{point.availabilityPercentage.toFixed(3)}%</td>
                  <td>{point.outageCount}</td>
                  <td>{point.downtimeMinutes.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p className="mt-2 text-[11px] text-gray-400">
        Dashed line marks the {targetPercentage}% SLA target. Axis is zoomed to
        the observed range so small deviations stay visible.
      </p>
    </section>
  );
}

export default memo(SlaTrendChart);
