'use client';

/**
 * SlaWidget — live SLA availability for the dashboard (closes #599).
 *
 * Availability is shown to three decimal places and can be polled at 15s, 30s
 * or 60s. Polling pauses itself whenever the browser tab is hidden, because
 * every refetch rides on the Page Visibility handling inside
 * {@link useAutoRefresh} rather than a second timer owned by this component.
 *
 * The percentage is derived from recorded outage downtime (see
 * `@/lib/slaAvailability`) rather than read from a dedicated field, because the
 * analytics endpoint exposes no uptime number.
 */

import { memo, useMemo } from 'react';

import AutoRefreshControl from '@/components/dashboard/AutoRefreshControl';
import {
  SLA_WIDGET_REFRESH_OPTIONS,
  useAutoRefresh,
} from '@/hooks/useAutoRefresh';
import { useDashboardOutageSample } from '@/hooks/useDashboardOutageSample';
import { formatWindowLabel, resolveMetricWindow } from '@/lib/metricWindow';
import {
  AVAILABILITY_NO_DATA,
  computeAvailability,
  formatAvailability,
} from '@/lib/slaAvailability';

export interface SlaWidgetProps {
  /** Dashboard date filter lower bound (`YYYY-MM-DD`); blank means "no filter". */
  dateFrom?: string;
  /** Dashboard date filter upper bound (`YYYY-MM-DD`); blank means "no filter". */
  dateTo?: string;
  className?: string;
}

function SlaWidget({ dateFrom, dateTo, className }: SlaWidgetProps) {
  // The hook already resolves the selected interval to `false` while the tab is
  // hidden, so `refetchInterval` alone is the whole pause/resume story.
  const autoRefresh = useAutoRefresh();
  const query = useDashboardOutageSample(autoRefresh.refetchInterval);

  const window = useMemo(
    () => resolveMetricWindow(dateFrom, dateTo),
    [dateFrom, dateTo]
  );

  const sample = query.data?.items;
  const result = useMemo(
    () => computeAvailability(sample ?? [], window),
    [sample, window]
  );

  // An empty sample means the data source returned nothing at all, which is not
  // the same as "no downtime". Reporting 100.000% there would assert perfect
  // uptime from missing data, so the widget says so instead.
  const hasSample = (sample?.length ?? 0) > 0;
  const value = hasSample
    ? formatAvailability(result.percentage)
    : AVAILABILITY_NO_DATA;

  const isHealthDegraded =
    hasSample && result.percentage !== null && result.percentage < 100;

  return (
    <section
      data-testid="sla-availability-widget"
      aria-labelledby="sla-availability-heading"
      className={`rounded-xl border-l-4 border-blue-500 bg-white p-5 shadow-sm ${className ?? ''}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id="sla-availability-heading"
            className="text-sm font-semibold text-gray-600 uppercase tracking-wide"
          >
            SLA Availability
          </h3>
          <p className="mt-1 text-xs text-gray-400">
            {formatWindowLabel(window)}
          </p>
        </div>
        <AutoRefreshControl
          value={autoRefresh.intervalMs}
          onChange={autoRefresh.setIntervalMs}
          isTabVisible={autoRefresh.isTabVisible}
          options={SLA_WIDGET_REFRESH_OPTIONS}
          ariaLabel="Availability auto-refresh interval"
        />
      </div>

      <div className="mt-3 flex items-end gap-3">
        <p
          data-testid="sla-availability-value"
          className={`text-3xl font-bold tabular-nums ${
            hasSample ? 'text-gray-800' : 'text-gray-400'
          }`}
        >
          {value}
        </p>
        {query.isFetching ? (
          <span
            role="status"
            className="mb-1 flex items-center gap-1.5 text-xs text-blue-600"
          >
            <span
              className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500"
              aria-hidden="true"
            />
            Updating…
          </span>
        ) : null}
      </div>

      {query.isLoading ? (
        <p className="mt-2 text-xs text-gray-400">
          Loading availability for the selected range…
        </p>
      ) : query.isError ? (
        <p className="mt-2 text-xs text-red-600">
          Availability is unavailable right now.{' '}
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="font-medium underline focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Retry
          </button>
        </p>
      ) : !hasSample ? (
        <p className="mt-2 text-xs text-gray-500">
          No outage records to measure availability against.
        </p>
      ) : (
        <p className="mt-2 text-xs text-gray-500">
          {result.affectedOutageCount} outage
          {result.affectedOutageCount === 1 ? '' : 's'} ·{' '}
          <span
            className={
              isHealthDegraded ? 'font-medium text-red-600' : 'text-gray-500'
            }
          >
            {result.downtimeMinutes.toFixed(1)}m downtime
          </span>
        </p>
      )}
    </section>
  );
}

export default memo(SlaWidget);
