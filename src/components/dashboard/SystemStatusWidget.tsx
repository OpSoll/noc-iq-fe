'use client';

/**
 * System status indicator
 *
 * Closes #611 – Dashboard: system status indicator (health pill)
 *
 * A compact pill in the dashboard header that reflects the backend readiness
 * probe. It is deliberately passive: it never blocks or refetches the page on
 * its own schedule beyond a 30s background poll, and an unreachable probe is
 * reported as an outage rather than silently hidden.
 */
import { useQuery } from '@tanstack/react-query';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/queryKeys';
import {
  getSystemHealth,
  summarizeSystemHealth,
  type DependencyStatus,
  type SystemHealthReport,
} from '@/services/systemHealth';

/** How often the readiness probe is re-checked. */
const POLL_INTERVAL_MS = 30_000;

type PillTone = 'operational' | 'degraded' | 'down' | 'unknown' | 'checking';

interface PillPresentation {
  label: string;
  /** Screen-reader friendly sentence for the trigger's accessible name. */
  announcement: string;
  pill: string;
  dot: string;
}

const PRESENTATION: Record<PillTone, PillPresentation> = {
  operational: {
    label: 'Operational',
    announcement: 'All systems operational',
    pill: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  degraded: {
    label: 'Degraded',
    announcement: 'Some systems are degraded',
    pill: 'border-amber-200 bg-amber-50 text-amber-800',
    dot: 'bg-amber-500',
  },
  down: {
    label: 'Down',
    announcement: 'System outage detected',
    pill: 'border-red-200 bg-red-50 text-red-700',
    dot: 'bg-red-500',
  },
  unknown: {
    label: 'Unknown',
    announcement: 'System status is unknown',
    pill: 'border-slate-200 bg-slate-50 text-slate-600',
    dot: 'bg-slate-400',
  },
  checking: {
    label: 'Checking…',
    announcement: 'Checking system status',
    pill: 'border-slate-200 bg-slate-50 text-slate-500',
    dot: 'bg-slate-400 animate-pulse',
  },
};

function formatLatency(latencyMs: number | undefined): string | null {
  if (typeof latencyMs !== 'number' || !Number.isFinite(latencyMs)) {
    return null;
  }
  return `${Math.round(latencyMs)}ms`;
}

/**
 * Build the tooltip body: one line per dependency plus the probe round trip.
 * Exported so the wording is unit testable without mounting a Radix portal.
 */
export function buildStatusDetail(
  report: SystemHealthReport | undefined,
  errorMessage?: string
): string[] {
  if (errorMessage) {
    return ['Readiness probe failed.', errorMessage];
  }
  if (!report) {
    return ['Contacting the readiness probe…'];
  }

  const lines = report.checks.map((check) => {
    const parts = [`${check.name}: ${check.status}`];
    const latency = formatLatency(check.latency_ms);
    if (latency) parts.push(latency);
    if (check.message) parts.push(check.message);
    return parts.join(' · ');
  });

  if (lines.length === 0) {
    lines.push('The readiness probe reported no dependencies.');
  }

  const probe = formatLatency(report.latency_ms);
  if (probe) {
    lines.push(`Readiness probe ${probe}`);
  }

  return lines;
}

export interface SystemStatusWidgetProps {
  /** Extra classes for the status pill. */
  className?: string;
}

export default function SystemStatusWidget({
  className,
}: SystemStatusWidgetProps) {
  const query = useQuery({
    queryKey: queryKeys.systemHealth.all,
    queryFn: getSystemHealth,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });

  const isChecking = query.isPending;
  const tone: PillTone = isChecking
    ? 'checking'
    : query.isError
      ? 'down'
      : summarizeSystemHealth(query.data?.checks);

  const presentation = PRESENTATION[tone];
  const errorMessage = query.isError
    ? query.error instanceof Error
      ? query.error.message
      : 'Unknown error'
    : undefined;
  const detail = buildStatusDetail(query.data, errorMessage);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={presentation.announcement}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
              presentation.pill,
              className
            )}
          >
            <span
              aria-hidden="true"
              className={cn('h-2 w-2 rounded-full', presentation.dot)}
            />
            {presentation.label}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <ul className="space-y-1">
            {detail.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
