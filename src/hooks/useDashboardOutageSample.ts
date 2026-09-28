'use client';

import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import { getOutages } from '@/services/outages';

/**
 * One outage sample shared by the dashboard's availability widget (#599) and
 * the MTTR/MTBF cards (#600), so mounting both costs a single request.
 *
 * Unlike the MTTR histogram's sample this deliberately does **not** filter to
 * `status: 'resolved'`: availability has to count downtime that is still
 * accruing, because an open outage is the site being down right now. MTTR is
 * unaffected by the wider sample — `outageMttrMinutes()` already returns null
 * for anything without a resolution.
 *
 * `page_size` matches the histogram and export modal, so the sample is a like
 * for like comparison with the distribution chart rendered beside it.
 */
export const DASHBOARD_OUTAGE_SAMPLE_PARAMS = { page_size: 500 };

/**
 * Fetches the dashboard outage sample, optionally polling.
 *
 * `refetchInterval` is passed straight to React Query, so the Page Visibility
 * handling in {@link useAutoRefresh} (`false` while the tab is hidden) pauses
 * polling without any extra wiring here.
 */
export function useDashboardOutageSample(
  refetchInterval: number | false = false
) {
  return useQuery({
    queryKey: queryKeys.outages.list(DASHBOARD_OUTAGE_SAMPLE_PARAMS),
    queryFn: () => getOutages(DASHBOARD_OUTAGE_SAMPLE_PARAMS),
    staleTime: 15_000,
    refetchInterval,
  });
}
