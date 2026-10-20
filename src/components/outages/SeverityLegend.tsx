'use client';

/**
 * SeverityLegend — a keyboard-accessible legend for outage severities
 * (closes #1001).
 *
 * The severity badges are colour-coded, and colour alone is not a sufficient
 * carrier of meaning (WCAG 2.1 SC 1.4.1). The existing legend tooltips were
 * hover-only, so a keyboard user could never read the description of a
 * severity. Each entry is now a real focusable button:
 *
 *   - the tooltip is shown on focus as well as on hover,
 *   - `Escape` dismisses it and returns focus to the trigger,
 *   - the description is linked with `aria-describedby` so a screen reader
 *     reads it on focus even while the tooltip is collapsed,
 *   - focus order follows the visual order (critical → low).
 */

import { useId, useState } from 'react';

import type { Severity } from '@/types/outages';

interface SeverityMeta {
  severity: Severity;
  className: string;
  icon: string;
  label: string;
  description: string;
}

/** Ordered most severe first, matching the visual and focus order. */
export const SEVERITY_LEGEND: SeverityMeta[] = [
  {
    severity: 'critical',
    className: 'bg-red-700 text-white',
    icon: '▲',
    label: 'Critical',
    description:
      'Service is fully down or affecting many subscribers. Immediate action required.',
  },
  {
    severity: 'high',
    className: 'bg-orange-600 text-white',
    icon: '◆',
    label: 'High',
    description:
      'Significant degradation with a clear subscriber impact. Investigate promptly.',
  },
  {
    severity: 'medium',
    className: 'bg-amber-500 text-black',
    icon: '●',
    label: 'Medium',
    description:
      'Partial or intermittent impact with a workaround available. Monitor closely.',
  },
  {
    severity: 'low',
    className: 'bg-slate-500 text-white',
    icon: '○',
    label: 'Low',
    description:
      'Minor impact with no immediate subscriber effect. Address during normal work.',
  },
];

export default function SeverityLegend() {
  const baseId = useId();
  const [open, setOpen] = useState<Severity | null>(null);

  return (
    <div
      role="group"
      aria-label="Severity legend"
      data-testid="severity-legend"
      className="flex flex-wrap items-center gap-2"
    >
      {SEVERITY_LEGEND.map((entry) => {
        const tipId = `${baseId}-${entry.severity}`;
        const isOpen = open === entry.severity;
        return (
          <span key={entry.severity} className="relative inline-flex">
            <button
              type="button"
              data-testid={`severity-legend-${entry.severity}`}
              aria-describedby={tipId}
              aria-expanded={isOpen}
              onMouseEnter={() => setOpen(entry.severity)}
              onMouseLeave={() => setOpen((cur) => (cur === entry.severity ? null : cur))}
              onFocus={() => setOpen(entry.severity)}
              onBlur={() => setOpen((cur) => (cur === entry.severity ? null : cur))}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setOpen(null);
                  e.currentTarget.blur();
                }
              }}
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${entry.className}`}
            >
              <span aria-hidden>{entry.icon}</span>
              {entry.label}
            </button>

            {/* Always in the DOM so aria-describedby resolves while collapsed. */}
            <span
              id={tipId}
              role="tooltip"
              data-testid={`severity-legend-tooltip-${entry.severity}`}
              className={
                isOpen
                  ? 'absolute left-0 top-full z-20 mt-1 w-56 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 shadow-md'
                  : 'sr-only'
              }
            >
              {entry.description}
            </span>
          </span>
        );
      })}
    </div>
  );
}
