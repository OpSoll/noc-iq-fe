'use client';

/**
 * OutageAlertBanner
 *
 * Sticky alert pinned to the very top of the SLA dashboard that surfaces the
 * longest-running open critical outage, so an operator never has to scroll the
 * outage list to discover an in-flight incident. Dismissal is remembered per
 * outage id (not as a blanket flag), which means a brand new critical outage
 * always re-opens the banner.
 *
 * Closes #604
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';

import { SeverityBadge } from '@/components/shared/SeverityBadgeAndShortcuts';
import { Button } from '@/components/ui/button';
import { AlertTriangleIcon } from '@/components/ui/icons';
import { queryKeys } from '@/lib/queryKeys';
import { getOutages } from '@/services/outages';
import type { Outage } from '@/types/outages';

// ─── Constants ───────────────────────────────────────────────────────────────
/** Only open critical incidents are eligible for the dashboard alert. */
export const OPEN_CRITICAL_PARAMS = {
  status: 'open',
  severity: 'critical',
  page_size: 50,
} as const;

/** localStorage key holding the id of the outage whose alert was dismissed. */
export const DISMISSED_OUTAGE_KEY = 'noc_dismissed_outage_alert';

const OUTAGES_REFETCH_MS = 30_000;
const AGE_TICK_MS = 30_000;
const MINUTE_MS = 60_000;

// ─── Pure helpers ────────────────────────────────────────────────────────────

export interface SelectWorstOptions {
  /** Outage id to skip; used to honour a per-outage dismissal. */
  excludeId?: string | null;
}

/**
 * Picks the outage the alert should talk about: the longest-running open
 * critical incident. Returns `null` when there is nothing worth alerting on.
 *
 * `options.excludeId` lets the caller drop a single already-dismissed outage
 * from the selection, so a newly opened critical incident surfaces immediately
 * instead of hiding behind the outage the operator just dismissed.
 */
export function selectWorstOpenCritical(
  outages: Outage[],
  options: SelectWorstOptions = {}
): Outage | null {
  const openCritical = outages.filter(
    (outage) =>
      outage.status === 'open' &&
      outage.severity === 'critical' &&
      outage.id !== options.excludeId
  );
  if (openCritical.length === 0) return null;

  return openCritical.reduce((worst, current) => {
    const worstTime = new Date(worst.detected_at).getTime();
    const currentTime = new Date(current.detected_at).getTime();
    if (Number.isNaN(currentTime)) return worst;
    if (Number.isNaN(worstTime)) return current;
    // Oldest detection wins: it has been running longest.
    return currentTime < worstTime ? current : worst;
  });
}

/** Renders how long ago an incident started, e.g. `2h 15m ago`. */
export function formatRelativeAge(
  startedAt: string,
  now: Date = new Date()
): string {
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return 'Unknown start time';

  const minutes = Math.floor((now.getTime() - start) / MINUTE_MS);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m ago` : `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days}d ${restHours}h ago` : `${days}d ago`;
}

/** Reads the dismissed outage id; storage failures degrade to "not dismissed". */
export function readDismissedOutageId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(DISMISSED_OUTAGE_KEY);
  } catch {
    return null;
  }
}

/** Persists the dismissed outage id; storage failures are ignored on purpose. */
export function writeDismissedOutageId(outageId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (outageId === null) {
      window.localStorage.removeItem(DISMISSED_OUTAGE_KEY);
      return;
    }
    window.localStorage.setItem(DISMISSED_OUTAGE_KEY, outageId);
  } catch {
    // Private-mode / blocked storage: the dismissal is session-only.
  }
}

/** Incident detail route the "Inspect Outage" action navigates to. */
export function buildOutageHref(outageId: string): string {
  return `/outages/${encodeURIComponent(outageId)}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface OutageAlertBannerProps {
  /** Poll interval for the open-critical outage query. */
  refetchIntervalMs?: number;
  /** Injectable clock, kept for deterministic tests and storybook-style use. */
  now?: Date;
}

export function OutageAlertBanner({
  refetchIntervalMs = OUTAGES_REFETCH_MS,
  now: injectedNow,
}: OutageAlertBannerProps = {}) {
  const router = useRouter();
  const [now, setNow] = useState<Date>(() => injectedNow ?? new Date());
  const [dismissedId, setDismissedId] = useState<string | null>(() =>
    readDismissedOutageId()
  );

  useEffect(() => {
    if (injectedNow) return;
    const id = setTimeout(() => setNow(new Date()), AGE_TICK_MS);
    return () => clearTimeout(id);
  }, [injectedNow, now]);

  const outagesQuery = useQuery({
    queryKey: queryKeys.outages.list({ ...OPEN_CRITICAL_PARAMS }),
    queryFn: () => getOutages({ ...OPEN_CRITICAL_PARAMS }),
    staleTime: 15_000,
    refetchInterval: refetchIntervalMs,
  });

  if (outagesQuery.isError) return null;

  const alert = selectWorstOpenCritical(outagesQuery.data?.items ?? [], {
    excludeId: dismissedId,
  });
  if (!alert) return null;

  function dismiss() {
    setDismissedId(alert.id);
    writeDismissedOutageId(alert.id);
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="sticky top-0 z-30 -mx-1 flex flex-wrap items-center gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 shadow-md"
    >
      <span className="text-red-600" aria-hidden="true">
        <AlertTriangleIcon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-red-800">
          Active critical outage at {alert.site_name}
        </p>
        <p className="text-xs text-red-700">
          <span className="font-mono">
            {formatRelativeAge(alert.detected_at, now)}
          </span>
          <span aria-hidden="true"> · </span>
          <span>started {new Date(alert.detected_at).toLocaleString()}</span>
          <span className="ml-2 align-middle">
            <SeverityBadge severity={alert.severity} />
          </span>
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        onClick={() => router.push(buildOutageHref(alert.id))}
      >
        Inspect Outage
      </Button>
      <button
        type="button"
        aria-label="Dismiss outage alert"
        onClick={dismiss}
        className="rounded-md p-1 text-red-600 transition-colors hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export default OutageAlertBanner;
