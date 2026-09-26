'use client';

/**
 * TableStatusPill
 *
 * Header pill for the outages table. It reports how long ago the rows were
 * refreshed, keeps that age honest by ticking once a second, and optionally
 * offers a manual refresh. With no timestamp it says the table has not been
 * refreshed yet, which is the truthful answer for a list that was rendered
 * without a fetch behind it.
 *
 * Closes #624 - Outages: Add refresh status indicator to the outages table
 */

import { useEffect, useState } from 'react';

import { RefreshCwIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

// ─── Constants ───────────────────────────────────────────────────────────────

const TICK_MS = 1_000;
const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
/** Below this an age reads better as "just now" than as "3s ago". */
const JUST_NOW_MS = 5 * SECOND_MS;

// ─── Formatting ──────────────────────────────────────────────────────────────

/** Compact age such as `just now`, `42s ago`, `5m ago`, `3h ago`, `2d ago`. */
export function formatRelativeAge(ageMs: number): string {
  if (ageMs < JUST_NOW_MS) return 'just now';
  if (ageMs < MINUTE_MS) return `${Math.floor(ageMs / SECOND_MS)}s ago`;

  const minutes = Math.floor(ageMs / MINUTE_MS);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(ageMs / HOUR_MS);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(ageMs / DAY_MS)}d ago`;
}

/** Epoch ms for the accepted timestamp shapes, `null` when unusable. */
function toTimestamp(
  value: number | Date | string | null | undefined
): number | null {
  if (value == null) return null;

  const ms =
    value instanceof Date
      ? value.getTime()
      : typeof value === 'string'
        ? new Date(value).getTime()
        : value;

  return Number.isNaN(ms) ? null : ms;
}

// ─── Age hook ────────────────────────────────────────────────────────────────

/**
 * Milliseconds since `updatedAt`, refreshed on a timer. A negative age (a
 * timestamp from the future, e.g. a skewed clock) clamps to zero rather than
 * rendering "-2s ago". A `null` timestamp means "never", so there is nothing
 * to tick.
 */
function useRelativeAge(updatedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  const isLive = updatedAt !== null;

  useEffect(() => {
    if (!isLive) return;

    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [isLive]);

  if (updatedAt === null) return 0;

  return Math.max(0, now - updatedAt);
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface TableStatusPillProps {
  /** When the rows were last refreshed, `null` when they never were. */
  updatedAt?: number | Date | string | null;
  /** True while a refresh is in flight. */
  isRefreshing?: boolean;
  /** Manual refresh handler. The button is omitted when this is absent. */
  onRefresh?: () => void;
  /** Extra classes for the wrapper. */
  className?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TableStatusPill({
  updatedAt = null,
  isRefreshing = false,
  onRefresh,
  className,
}: TableStatusPillProps) {
  const timestamp = toTimestamp(updatedAt);
  const hasTimestamp = timestamp !== null;
  const ageMs = useRelativeAge(timestamp);

  const label = hasTimestamp
    ? `Updated ${formatRelativeAge(ageMs)}`
    : 'Not refreshed yet';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
        'text-xs font-medium',
        hasTimestamp
          ? 'border-gray-200 bg-white text-gray-600'
          : 'border-amber-200 bg-amber-50 text-amber-700',
        className
      )}
    >
      <span>{label}</span>

      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Refresh outages now"
          title="Refresh outages now"
          className="rounded-full p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <RefreshCwIcon
            className={cn(
              'h-3.5 w-3.5',
              isRefreshing && 'animate-spin motion-reduce:animate-none'
            )}
          />
        </button>
      )}
    </span>
  );
}
