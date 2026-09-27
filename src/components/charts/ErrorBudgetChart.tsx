'use client';

/**
 * ErrorBudgetChart
 *
 * Hand-rolled (no charting library) error-budget bar chart. Colours come from
 * the shared chart theme so gridlines, labels and series stay above the WCAG
 * contrast floors in light and dark mode.
 *
 * Closes #608 – Dashboard: dark mode colour contrast optimization for charts
 */

import { useMemo, memo } from 'react';

import { useChartTheme } from '@/components/charts/useChartTheme';

export interface ErrorBudgetDataPoint {
  date: string;
  errors: number;
  totalRequests: number;
}

interface ErrorBudgetChartProps {
  data: ErrorBudgetDataPoint[];
  thresholdPercent?: number;
  windowLabel?: string;
}

function ErrorBudgetChart({
  data,
  thresholdPercent = 99.5,
  windowLabel = '30d',
}: ErrorBudgetChartProps) {
  const { theme } = useChartTheme();

  const chartBars = useMemo(() => {
    if (data.length === 0) return [];
    const maxRequests = Math.max(...data.map((d) => d.totalRequests), 1);
    return data.map((d) => ({
      ...d,
      errorRate:
        d.totalRequests > 0
          ? ((d.totalRequests - d.errors) / d.totalRequests) * 100
          : 100,
      heightPercent: (d.totalRequests / maxRequests) * 100,
      isError:
        d.totalRequests > 0 &&
        ((d.totalRequests - d.errors) / d.totalRequests) * 100 <
          thresholdPercent,
    }));
  }, [data, thresholdPercent]);

  const overallErrorRate = useMemo(() => {
    const totalReqs = data.reduce((sum, d) => sum + d.totalRequests, 0);
    const totalErrs = data.reduce((sum, d) => sum + d.errors, 0);
    if (totalReqs === 0) return 100;
    return ((totalReqs - totalErrs) / totalReqs) * 100;
  }, [data]);

  const budgetRemaining = Math.max(
    0,
    overallErrorRate - (100 - thresholdPercent)
  );

  const onTarget = overallErrorRate >= thresholdPercent;
  const hasBudget = budgetRemaining > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3
          className="text-sm font-semibold"
          style={{ color: theme.axisLabel }}
        >
          Error Budget Trend ({windowLabel})
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <span
            className="flex items-center gap-1"
            style={{ color: theme.muted }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: theme.positive }}
              aria-hidden="true"
            />{' '}
            Healthy
          </span>
          <span
            className="flex items-center gap-1"
            style={{ color: theme.muted }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: theme.negative }}
              aria-hidden="true"
            />{' '}
            Breach
          </span>
        </div>
      </div>

      <div
        className="grid grid-cols-3 gap-4 rounded-lg border p-3"
        style={{ borderColor: theme.gridLine, backgroundColor: theme.surface }}
      >
        <div className="text-center">
          <p className="text-xs" style={{ color: theme.muted }}>
            Current SLA
          </p>
          <p
            className="text-lg font-bold"
            style={{ color: onTarget ? theme.positive : theme.negative }}
          >
            {overallErrorRate.toFixed(2)}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs" style={{ color: theme.muted }}>
            Threshold
          </p>
          <p className="text-lg font-bold" style={{ color: theme.axisLabel }}>
            {thresholdPercent}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs" style={{ color: theme.muted }}>
            Budget Remaining
          </p>
          <p
            className="text-lg font-bold"
            style={{ color: hasBudget ? theme.positive : theme.negative }}
          >
            {budgetRemaining.toFixed(2)}pp
          </p>
        </div>
      </div>

      {chartBars.length > 0 ? (
        <div className="flex items-end gap-1" style={{ height: 120 }}>
          {chartBars.map((bar, idx) => (
            <div
              key={idx}
              className="group relative flex-1"
              style={{ height: '100%' }}
            >
              <div
                className="absolute bottom-0 w-full"
                style={{ height: `${bar.heightPercent}%` }}
              >
                <div
                  className="h-full w-full rounded-t opacity-80 transition-colors hover:opacity-100"
                  style={{
                    backgroundColor: bar.isError
                      ? theme.negative
                      : theme.positive,
                  }}
                />
              </div>
              <div
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded px-2 py-1 text-xs shadow group-hover:block"
                style={{
                  backgroundColor: theme.axisLabel,
                  color: theme.surface,
                }}
              >
                {bar.date}: {bar.errorRate.toFixed(2)}% SLA ({bar.errors}/
                {bar.totalRequests} errors)
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-8 text-center text-sm" style={{ color: theme.muted }}>
          No data available for this window.
        </p>
      )}

      {chartBars.length > 0 && (
        <p className="text-right text-xs" style={{ color: theme.muted }}>
          Threshold line: {thresholdPercent}% SLA
        </p>
      )}
    </div>
  );
}

export default memo(ErrorBudgetChart);
