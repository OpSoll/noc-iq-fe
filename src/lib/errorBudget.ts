/**
 * Error-budget maths for the breach-risk gauge (closes #601).
 *
 * The budget is expressed in **minutes of allowed downtime**, derived from the
 * compliance target and the length of the measured window:
 * `allowed = windowMinutes × (1 − target/100)`. That is a different quantity
 * from the percentage-point variance `ErrorBudgetChart` reports for a series of
 * daily points, so the arithmetic lives here rather than being folded into that
 * chart's local calculation.
 */

/** Consumption at or above this percentage is "warning" (amber). */
export const BUDGET_WARNING_THRESHOLD = 75;

/** Consumption at or above this percentage is "critical" (red). */
export const BUDGET_CRITICAL_THRESHOLD = 90;

export type BudgetRiskLevel = 'healthy' | 'warning' | 'critical';

export interface ErrorBudget {
  /** Minutes of downtime the target allows across the window. */
  allowedDowntimeMinutes: number;
  /** Minutes of downtime actually observed. */
  downtimeMinutes: number;
  /** Consumption clamped to 0-100, for the gauge sweep and the readout. */
  consumedPercentage: number;
  /** Unclamped consumption, so an overspent budget is not hidden as "100%". */
  rawConsumedPercentage: number;
  /** Allowance left, floored at 0 once the budget is exhausted. */
  remainingMinutes: number;
  /** True when observed downtime has met or exceeded the allowance. */
  isExhausted: boolean;
  riskLevel: BudgetRiskLevel;
}

/** True for a compliance target that yields a usable, non-zero budget. */
function isUsableTarget(targetPercentage: number): boolean {
  return (
    Number.isFinite(targetPercentage) &&
    targetPercentage > 0 &&
    targetPercentage < 100
  );
}

/**
 * Minutes of downtime a target permits over a window.
 *
 * Returns null for a target of 100% (which allows zero downtime and would make
 * every consumption figure a division by zero) and for 0% (which permits the
 * entire window).
 */
export function allowedDowntimeMinutes(
  windowMinutes: number,
  targetPercentage: number
): number | null {
  if (!Number.isFinite(windowMinutes) || windowMinutes <= 0) return null;
  if (!isUsableTarget(targetPercentage)) return null;

  return windowMinutes * (1 - targetPercentage / 100);
}

/** Maps consumption onto the issue's green / yellow / red bands. */
export function riskLevelFor(consumedPercentage: number): BudgetRiskLevel {
  if (!Number.isFinite(consumedPercentage)) return 'healthy';
  if (consumedPercentage >= BUDGET_CRITICAL_THRESHOLD) return 'critical';
  if (consumedPercentage >= BUDGET_WARNING_THRESHOLD) return 'warning';
  return 'healthy';
}

/**
 * Builds the gauge's view model.
 *
 * Returns null when no budget can be derived, so the caller can render an
 * explicit "no budget" state instead of a gauge sweeping to an invented value.
 */
export function computeErrorBudget(
  downtimeMinutes: number,
  windowMinutes: number,
  targetPercentage: number
): ErrorBudget | null {
  const allowed = allowedDowntimeMinutes(windowMinutes, targetPercentage);
  if (allowed === null) return null;

  const observed =
    Number.isFinite(downtimeMinutes) && downtimeMinutes > 0
      ? downtimeMinutes
      : 0;

  const rawConsumedPercentage = (observed / allowed) * 100;
  const remainingMinutes = Math.max(0, allowed - observed);

  return {
    allowedDowntimeMinutes: allowed,
    downtimeMinutes: observed,
    consumedPercentage: Math.min(100, Math.max(0, rawConsumedPercentage)),
    rawConsumedPercentage,
    remainingMinutes,
    isExhausted: observed >= allowed,
    riskLevel: riskLevelFor(rawConsumedPercentage),
  };
}

/**
 * Human-readable allowance left, e.g. `18.4 min remaining` or
 * `Budget exhausted`.
 */
export function formatRemainingMinutes(remainingMinutes: number): string {
  if (!Number.isFinite(remainingMinutes) || remainingMinutes <= 0) {
    return 'Budget exhausted';
  }
  return `${remainingMinutes.toFixed(1)} min remaining`;
}
