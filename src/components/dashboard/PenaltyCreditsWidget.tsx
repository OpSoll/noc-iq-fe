'use client';

// ─── PenaltyCreditsWidget ────────────────────────────────────────────────────
// Closes #607

import type { DashboardMetrics } from '@/types/dashboard';
import { calculatePenaltyCredits, groupCreditsByContract } from '@/lib/penaltyCredits';
import type { MonthlyPenaltyPoint } from '@/lib/penaltyCredits';

const DEFAULT_XLM_RATE = 1;

/** Formats a number with locale-aware thousands separator (simulates en-US). */
function formatUsd(value: number): string {
  return `${value >= 0 ? '' : '-'}${Math.abs(value).toLocaleString()}`;
}

/** Formats a number with locale-aware thousands separator. */
function formatNumber(value: number): string {
  return Math.abs(value).toLocaleString();
}

/** PenaltyCreditsWidget */
interface PenaltyCreditsWidgetProps {
  metrics: DashboardMetrics;
  /** Optional XLM rate for conversion; defaults to 1 when no rate source is configured. */
  xlmRate?: number;
}

/**
 * Widget that displays accumulated SLA penalty credits for the current billing month,
 * a per‑contract breakdown, and an Export Report action.
 *
 * Feeds on the already‑fetched `metrics` from the dashboard — no extra request is issued.
 */
export function PenaltyCreditsWidget({
  metrics,
  xlmRate = DEFAULT_XLM_RATE,
}: PenaltyCreditsWidgetProps) {
  const { total, monthly } = useMemo(
    () => calculatePenaltyCredits(metrics),
    [metrics]
  );

  const { total: grandTotal, byContract } = useMemo(
    () => groupCreditsByContract(monthly, { contracts: ['Contract A', 'Contract B', 'Contract C'] }),
    [monthly]
  );

  const formattedUsd = formatUsd(total);
  const formattedXlm = `${((total ?? 0) / xlmRate).toFixed(2).replace('.', ',')} XLM`;

  const rangeLabel = useMemo(() => {
    if (!monthly.length) return 'No data';
    const first = monthly[0].period || '–';
    const last = monthly[monthly.length - 1].period || '–';
    return `${first} → ${last}`;
  }, [monthly]);

  function handleExportReport() {
    const csvRows = [
      ['Period', 'Penalty Credits (USD)'],
      ...monthly.map((p) => [p.period, `$${formatUsd(p.penalties)}`]),
      ['Total', `$${formatUsd(total)}`],
    ];
    const csvString = csvRows
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `penalty-credits-${rangeLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-gray-600 uppercase tracking-wide">
        SLA Penalty Credits
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500">Total (USD)</p>
          <p className="mt-1 text-xl font-bold text-slate-900">${formattedUsd}</p>
          <p className="text-[11px] text-slate-400">Billing month: {rangeLabel}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500">Total (XLM)</p>
          <p className="mt-1 text-xl font-bold text-slate-900">${formattedXlm}</p>
          <p className="text-[11px] text-slate-400">Rate: 1 XLM = {xlmRate} USD</p>
        </div>
        <div
          className={`rounded-lg border p-3 ${
            total >= 0 ? 'border-green-100 bg-green-50' : 'border-red-100 bg-red-50'}
          `}
        >
          <p className="text-xs font-medium text-slate-500">Net Balance</p>
          <p
            className={`mt-1 text-xl font-bold ${
              total >= 0 ? 'text-green-700' : 'text-red-700'}
            }`}
          >
            {total >= 0 ? '+' : ''}${
              formatNumber(total ?? 0)
            }
          </p>
          <p className="text-[11px] text-slate-400">vs. previous period</p>
        </div>
      </div>

      {/* Per‑contract breakdown */}
      {Object.keys(byContract).length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Breakdown by contract
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(byContract).map(([contract, amount]) => (
              <div
                key={contract}
                className="flex flex-col items-start gap-1"
              >
                <span className="text-[10px] text-slate-500 truncate">{contract}</span>
                <div
                  className={`h-1.5 rounded bg-slate-200 overflow-hidden motion-reduce:transition-none motion-reduce:bg-slate-300`}
                  style={{ width: `${((amount ?? 0) / (grandTotal ?? 1)) * 100}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export Report button */}
      <Button
        type="button"
        onClick={handleExportReport}
        className="mt-4 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
      >
        Export Report
      </Button>
    </div>
  );
}

export default PenaltyCreditsWidget;