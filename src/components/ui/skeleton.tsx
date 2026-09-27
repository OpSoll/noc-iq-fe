/**
 * Skeleton placeholders
 *
 * Closes #610 – Dashboard: skeleton loading state placeholders for metric
 * cards
 *
 * `Skeleton` is the original single-block primitive and is unchanged. The
 * composed helpers below mirror the exact box model of the widgets they stand
 * in for (KPICard, SLATrendChart, PenaltiesRewardsChart), so swapping the
 * placeholder for real content does not move a single pixel and cumulative
 * layout shift stays at ~0 during the initial page boot.
 *
 * Accessibility: every decorative bar is `aria-hidden` and a single
 * `role="status"` wrapper carries one `sr-only` "Loading…" announcement, so a
 * screen reader hears a single status instead of dozens of empty regions.
 */
import { cn } from '@/lib/utils';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

// ─── Composed placeholders ───────────────────────────────────────────────────

/** Fallback width for the last line of a text block. */
const TEXT_LAST_LINE_WIDTH = 'w-2/3';

export interface SkeletonTextProps {
  /** Number of placeholder lines to render. */
  lines?: number;
  /** Tailwind height class for each line. */
  lineClassName?: string;
  /** Extra classes for the wrapping element. */
  className?: string;
}

/** Multi-line text placeholder with a shortened final line. */
function SkeletonText({
  lines = 3,
  lineClassName = 'h-3 w-full',
  className,
}: SkeletonTextProps) {
  const count = Math.max(0, lines);
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn(
            lineClassName,
            index === count - 1 && count > 1 && TEXT_LAST_LINE_WIDTH
          )}
        />
      ))}
    </div>
  );
}

export interface SkeletonStatProps {
  /** Extra classes for the wrapping element. */
  className?: string;
  /** Whether to render the muted caption line under the value. */
  withCaption?: boolean;
}

/**
 * Title + value + caption placeholder matching KPICard's inner layout: the
 * three line boxes add up to the same 80px of content the real card renders,
 * so the grid row does not resize when the metrics land.
 */
function SkeletonStat({ className, withCaption = true }: SkeletonStatProps) {
  return (
    <div className={cn('space-y-1', className)} aria-hidden="true">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-9 w-36" />
      {withCaption ? <Skeleton className="h-4 w-40" /> : null}
    </div>
  );
}

export interface SkeletonMetricCardProps {
  /** Card highlight tone, mirroring KPICard's `highlight` prop. */
  highlight?: 'green' | 'red' | 'blue' | 'yellow';
  /** Extra classes for the card shell. */
  className?: string;
}

const METRIC_CARD_TONES: Record<string, string> = {
  green: 'border-l-emerald-500 bg-emerald-50',
  red: 'border-l-red-500 bg-red-50',
  blue: 'border-l-blue-500 bg-blue-50',
  yellow: 'border-l-amber-500 bg-amber-50',
};

/**
 * Drop-in placeholder for `KPICard`: same border, shadow and `p-5` body
 * padding, so the grid row keeps its height while the metrics query resolves.
 */
function SkeletonMetricCard({
  highlight = 'blue',
  className,
}: SkeletonMetricCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border-l-4 shadow-sm',
        METRIC_CARD_TONES[highlight],
        className
      )}
    >
      <div className="p-5">
        <SkeletonStat />
      </div>
    </div>
  );
}

export interface SkeletonChartProps {
  /** Number of bar/track rows to stand in for. */
  rows?: number;
  /** Extra classes for the card shell. */
  className?: string;
}

/**
 * Placeholder for the bar-row trend charts. Each row reproduces SLATrendChart's
 * `p-1` shell, its `text-sm` label/value line and its `h-3` track, so a
 * populated chart occupies exactly the same box.
 */
function SkeletonChart({ rows = 4, className }: SkeletonChartProps) {
  const count = Math.max(0, rows);
  return (
    <div
      className={cn('rounded-xl bg-white p-5 shadow-sm', className)}
      aria-hidden="true"
    >
      <Skeleton className="mb-4 h-5 w-48" />
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="space-y-1 p-1">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-14" />
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export interface SkeletonCardProps {
  /** Whether to render the heading placeholder. */
  withHeader?: boolean;
  /** Extra classes for the card shell. */
  className?: string;
}

/** Generic card shell with a heading placeholder and body content. */
function SkeletonCard({ withHeader = true, className }: SkeletonCardProps) {
  return (
    <div
      className={cn('rounded-xl bg-white p-5 shadow-sm', className)}
      aria-hidden="true"
    >
      <div className="space-y-4">
        {withHeader ? <Skeleton className="h-4 w-48" /> : null}
        <SkeletonText lines={3} />
      </div>
    </div>
  );
}

// ─── Status wrapper ──────────────────────────────────────────────────────────

export interface SkeletonStatusProps {
  /** Text announced to assistive technology. */
  label?: string;
  /** Extra classes for the wrapper. */
  className?: string;
  children: React.ReactNode;
}

/**
 * Wraps any set of placeholders in a single `role="status"` live region so
 * assistive tech announces one "Loading…" message rather than one per bar.
 */
function SkeletonStatus({
  label = 'Loading…',
  className,
  children,
}: SkeletonStatusProps) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export {
  Skeleton,
  SkeletonCard,
  SkeletonChart,
  SkeletonMetricCard,
  SkeletonStat,
  SkeletonStatus,
  SkeletonText,
};
