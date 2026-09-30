'use client';

/**
 * MttrMtbfCards — MTTR and MTBF summary cards with trend indicators
 * (closes #600).
 *
 * Both values are derived from the outage records the dashboard already
 * fetches; neither is served by the analytics endpoint. The comparison baseline
 * is the immediately preceding period of equal length (the same "previous
 * cycle" convention the dashboard's Compare mode uses), computed from the same
 * sample so the cards add no further requests.
 *
 * Honest limitation: the sample is the most recent 500 outages, so if the
 * requested range reaches further back than that the previous-cycle baseline is
 * simply absent. In that case the cards report "No prior cycle to compare"
 * rather than a fabricated delta.
 */

import { memo, useMemo } from 'react';

import MetricCard from '@/components/dashboard/MetricCard';
import { useDashboardOutageSample } from '@/hooks/useDashboardOutageSample';
import {
  filterOutagesByDetectedAt,
  resolveMetricWindow,
  resolvePreviousWindow,
} from '@/lib/metricWindow';
import {
  compareMetric,
  describeComparison,
  formatMtbfDuration,
  formatMttrDuration,
  meanMttrMinutes,
  meanTimeBetweenFailuresDays,
} from '@/lib/mttrMtbf';

export interface MttrMtbfCardsProps {
  /** Dashboard date filter lower bound (`YYYY-MM-DD`). */
  dateFrom?: string;
  /** Dashboard date filter upper bound (`YYYY-MM-DD`). */
  dateTo?: string;
  className?: string;
}

function MttrMtbfCards({ dateFrom, dateTo, className }: MttrMtbfCardsProps) {
  const query = useDashboardOutageSample();

  const window = useMemo(
    () => resolveMetricWindow(dateFrom, dateTo),
    [dateFrom, dateTo]
  );

  const mttr = useMemo(() => {
    const outages = query.data?.items ?? [];
    return compareMetric(
      meanMttrMinutes(filterOutagesByDetectedAt(outages, window)),
      meanMttrMinutes(
        filterOutagesByDetectedAt(outages, resolvePreviousWindow(window))
      ),
      // Lower MTTR — resolving faster — is the improvement.
      true
    );
  }, [query.data, window]);

  const mtbf = useMemo(() => {
    const outages = query.data?.items ?? [];
    return compareMetric(
      meanTimeBetweenFailuresDays(filterOutagesByDetectedAt(outages, window)),
      meanTimeBetweenFailuresDays(
        filterOutagesByDetectedAt(outages, resolvePreviousWindow(window))
      ),
      // Higher MTBF — failing less often — is the improvement.
      false
    );
  }, [query.data, window]);

  if (query.isError) {
    return (
      <div
        className={`rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 ${className ?? ''}`}
      >
        Could not load reliability metrics.{' '}
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="font-medium underline focus-visible:ring-2 focus-visible:ring-red-500"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="mttr-mtbf-cards"
      className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${className ?? ''}`}
    >
      <MetricCard
        title="Mean Time To Resolution"
        value={query.isLoading ? '…' : formatMttrDuration(mttr.current)}
        changePercentage={mttr.changePercentage}
        trend={query.isLoading ? 'unknown' : mttr.trend}
        comparison={query.isLoading ? 'Loading…' : describeComparison(mttr)}
        detail="Average time from detection to resolution, over resolved outages."
      />
      <MetricCard
        title="Mean Time Between Failures"
        value={query.isLoading ? '…' : formatMtbfDuration(mtbf.current)}
        changePercentage={mtbf.changePercentage}
        trend={query.isLoading ? 'unknown' : mtbf.trend}
        comparison={query.isLoading ? 'Loading…' : describeComparison(mtbf)}
        detail="Average gap between consecutive outage detections."
      />
    </div>
  );
}

export default memo(MttrMtbfCards);
