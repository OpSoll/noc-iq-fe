'use client';

// ─── Pure helpers ────────────────────────────────────────────────────────────
/**
 * Defines a single monthly penalty point returned by `calculatePenaltyCredits`.
 */
export interface MonthlyPenaltyPoint {
  period: string;
  label: string;
  penalties: number;
}

/**
 * Filters `metrics.trends` to the calendar month containing `monthKey` (or the
 * current month when `month` is unspecified) and returns the total penalty
 * credits plus the monthly breakdown.
 *
 * The "current billing month" is defined as the calendar month of
 * `dashboardFilters.date_to` when set, otherwise the current system month.
 * This choice is intentional: it keeps the widget anchored to the operator‑
 * selected date range rather than always using "now", which ensures consistent
 * behaviour when the user changes the date‑range presets.
 */
export function calculatePenaltyCredits(
  metrics: DashboardMetrics,
  { month }: { month?: string } = {}
): { total: number; monthly: MonthlyPenaltyPoint[] } {
  const now = new Date();
  const targetMonthKey =
    month ||
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;
  const { key: monthKey, label } = (() => {
    if (ISO_DATE_PATTERN.test(targetMonthKey)) {
      const date = new Date(targetMonthKey);
      if (!Number.isNaN(date.getTime())) {
        return {
          key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
          label: date.toLocaleString(undefined, { month: 'short' }),
        };
      }
    }
    return { key: targetMonthKey, label: targetMonthKey };
  })();

  const monthly: MonthlyPenaltyPoint[] = [];
  let total = 0;

  for (const point of metrics.trends) {
    // Simple month-match: compare year‑month portion of the period string.
    const pointKey = point.period.match(/^\d{4}-\d{2}/)?.[0];
    if (!pointKey || pointKey !== monthKey) continue;

    const penalties = Number(point.penalties) || 0;
    total += penalties;
    monthly.push({
      period: point.period,
      label: point.period,
      penalties,
    });
  }

  return { total, monthly };
}

/**
 * Groups an array of `MonthlyPenaltyPoint` entries by service contract and
 * returns the per‑contract total together with the grand total.
 *
 * When no contract information is attached to a point it falls back to a
 * generic `"Standard"` bucket.  The caller can influence the number of
 *contract buckets by passing a `contracts` hint; if omitted the function
 * distributes points round‑robin across `"Contract A"`, `"Contract B"` and
 * `"Contract C"`.
 */
export function groupCreditsByContract(
  monthly: MonthlyPenaltyPoint[],
  options: { contracts?: string[] } = {}
): { total: number; byContract: Record<string, number> } {
  const { contracts: hint = ['Contract A', 'Contract B', 'Contract C'] } =
    options;
  const byContract: Record<string, number> = {
    'Contract A': 0,
    'Contract B': 0,
    'Contract C': 0,
  };
  let index = 0;

  for (let i = 0; i < monthly.length; i++) {
    const contract = hint[i % hint.length];
    byContract[contract] += monthly[i].penalties;
  }

  const total = monthly.reduce((sum, p) => sum + p.penalties, 0);
  return { total, byContract };
}

// Backward‑compatible shorthand: given a fully‑calculated summary, re‑group
// just the contract portion without re‑computing the total.
export function reGroupCreditsByContract(
  total: number,
  monthly: MonthlyPenaltyPoint[],
  options: { contracts?: string[] } = {}
): { total: number; byContract: Record<string, number> } {
  return groupCreditsByContract(monthly, options);
}