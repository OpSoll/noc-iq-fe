'use client';

/**
 * RiskGauge — radial gauge of monthly SLA error-budget consumption
 * (closes #601).
 *
 * The sweep shows how much of the allowed downtime has been spent. Colour is
 * banded green → amber at 75% → red at 90%, and because colour alone is not an
 * accessible signal the band is also written out next to the percentage, and
 * the exact remaining allowance is exposed through a hover tooltip, an SVG
 * `<title>` for the native browser tooltip, and the diagram's `aria-label`.
 *
 * Hand-rolled SVG, consistent with every other chart in this repo — there is no
 * charting library to inherit geometry from.
 */

import { memo, useMemo } from 'react';

import {
  BUDGET_CRITICAL_THRESHOLD,
  BUDGET_WARNING_THRESHOLD,
  computeErrorBudget,
  formatRemainingMinutes,
  type BudgetRiskLevel,
} from '@/lib/errorBudget';
import { DEFAULT_SLA_COMPLIANCE_TARGET } from '@/lib/slaTarget';

const SIZE = 220;
const CENTER = SIZE / 2;
const RADIUS = 84;
const STROKE_WIDTH = 18;

/** Path geometry, exported so the mapping can be unit tested directly. */
export interface GaugeGeometry {
  cx: number;
  cy: number;
  radius: number;
  strokeWidth: number;
}

export const GAUGE_GEOMETRY: GaugeGeometry = {
  cx: CENTER,
  cy: CENTER,
  radius: RADIUS,
  strokeWidth: STROKE_WIDTH,
};

/**
 * Converts a 0-100 consumption value into a point on the gauge.
 *
 * The sweep runs 180° → 360°: starting level with the centre on the left,
 * arcing up over the top, and finishing level on the right. `sin` is negative
 * through that range, which places the arc above the centre line in SVG's
 * y-down coordinate space.
 */
export function polarPoint(percentage: number, geometry = GAUGE_GEOMETRY) {
  const clamped = Number.isFinite(percentage)
    ? Math.min(100, Math.max(0, percentage))
    : 0;
  const angle = Math.PI * (1 + clamped / 100);
  return {
    x: geometry.cx + geometry.radius * Math.cos(angle),
    y: geometry.cy + geometry.radius * Math.sin(angle),
  };
}

/** SVG arc path covering `from` → `to` percent of the gauge sweep. */
export function arcPath(
  from: number,
  to: number,
  geometry = GAUGE_GEOMETRY
): string {
  const start = polarPoint(from, geometry);
  const end = polarPoint(to, geometry);

  return [
    `M ${start.x} ${start.y}`,
    `A ${geometry.radius} ${geometry.radius} 0 0 1 ${end.x} ${end.y}`,
  ].join(' ');
}

/**
 * Semantic risk palette. These are deliberately fixed green/amber/red rather
 * than the chart theme's series tokens, because the bands are a status
 * indicator whose meaning the issue pins to those three colours.
 */
const RISK_CLASSES: Record<BudgetRiskLevel, string> = {
  healthy: 'text-green-600',
  warning: 'text-amber-500',
  critical: 'text-red-600',
};

const RISK_LABELS: Record<BudgetRiskLevel, string> = {
  healthy: 'Healthy',
  warning: 'Warning',
  critical: 'Critical',
};

export interface RiskGaugeProps {
  /** Downtime observed in the measured window, in minutes. */
  downtimeMinutes: number;
  /** Length of the measured window, in minutes. */
  windowMinutes: number;
  /** SLA compliance target percentage the budget is derived from. */
  targetPercentage?: number;
  className?: string;
}

function RiskGauge({
  downtimeMinutes,
  windowMinutes,
  targetPercentage = DEFAULT_SLA_COMPLIANCE_TARGET,
  className,
}: RiskGaugeProps) {
  const budget = useMemo(
    () => computeErrorBudget(downtimeMinutes, windowMinutes, targetPercentage),
    [downtimeMinutes, windowMinutes, targetPercentage]
  );

  if (!budget) {
    return (
      <div
        data-testid="risk-gauge"
        className={`rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500 shadow-sm ${className ?? ''}`}
      >
        No error budget to gauge for a {targetPercentage}% target.
      </div>
    );
  }

  const riskClass = RISK_CLASSES[budget.riskLevel];
  const riskLabel = RISK_LABELS[budget.riskLevel];
  const remainingLabel = formatRemainingMinutes(budget.remainingMinutes);
  const consumed = budget.consumedPercentage;

  const accessibleLabel =
    `Error budget ${consumed.toFixed(1)}% consumed, ${riskLabel}. ` +
    `${remainingLabel}; ${budget.downtimeMinutes.toFixed(1)} of ` +
    `${budget.allowedDowntimeMinutes.toFixed(1)} allowed minutes used.`;

  return (
    <section
      data-testid="risk-gauge"
      aria-labelledby="risk-gauge-heading"
      className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${className ?? ''}`}
    >
      <h3
        id="risk-gauge-heading"
        className="text-sm font-semibold text-gray-600 uppercase tracking-wide"
      >
        SLA Breach Risk
      </h3>

      <div className="group relative mt-3 flex justify-center">
        <svg
          width={SIZE}
          height={CENTER + STROKE_WIDTH}
          viewBox={`0 0 ${SIZE} ${CENTER + STROKE_WIDTH}`}
          role="img"
          aria-label={accessibleLabel}
          className={riskClass}
        >
          <title>{accessibleLabel}</title>

          {/* Inert track: the full sweep the budget could consume. */}
          <path
            d={arcPath(0, 100)}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            className="text-gray-200"
            data-testid="risk-gauge-track"
          />

          {/* Consumed portion. */}
          {consumed > 0 ? (
            <path
              d={arcPath(0, consumed)}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              data-testid="risk-gauge-value"
              data-risk={budget.riskLevel}
            />
          ) : null}
        </svg>

        <div className="pointer-events-none absolute bottom-0 flex flex-col items-center">
          <span
            data-testid="risk-gauge-percent"
            className={`text-3xl font-bold tabular-nums ${riskClass}`}
          >
            {consumed.toFixed(1)}%
          </span>
          <span className="text-xs text-gray-500">{riskLabel}</span>
        </div>

        {/* Hover tooltip: the exact remaining allowance. */}
        <div
          data-testid="risk-gauge-tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block"
        >
          {remainingLabel} · {budget.downtimeMinutes.toFixed(1)}m of{' '}
          {budget.allowedDowntimeMinutes.toFixed(1)}m used
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-center text-xs">
        <div className="rounded-lg bg-gray-50 p-2">
          <dt className="text-gray-500">Allowed downtime</dt>
          <dd className="font-semibold text-gray-800">
            {budget.allowedDowntimeMinutes.toFixed(1)}m
          </dd>
        </div>
        <div className="rounded-lg bg-gray-50 p-2">
          <dt className="text-gray-500">
            {budget.isExhausted ? 'Overspent by' : 'Remaining'}
          </dt>
          <dd
            className={`font-semibold ${
              budget.isExhausted ? 'text-red-700' : 'text-gray-800'
            }`}
            data-testid="risk-gauge-remaining"
          >
            {budget.isExhausted
              ? `${(budget.downtimeMinutes - budget.allowedDowntimeMinutes).toFixed(1)}m`
              : `${budget.remainingMinutes.toFixed(1)}m`}
          </dd>
        </div>
      </dl>

      <p className="mt-2 text-center text-[11px] text-gray-400">
        Amber at {BUDGET_WARNING_THRESHOLD}% · red at{' '}
        {BUDGET_CRITICAL_THRESHOLD}% of a {targetPercentage}% target
      </p>
    </section>
  );
}

export default memo(RiskGauge);
