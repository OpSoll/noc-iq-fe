'use client';

/**
 * MetricDefinitionTip — an accessible per-metric definition tooltip
 * (closes #1017).
 *
 * Dashboard KPIs such as MTTR and violation rate are used without ever stating
 * what they measure, so an operator cannot tell whether a number is good or
 * where it comes from. This renders an info affordance beside the metric title
 * with the definition.
 *
 * Accessibility:
 *   - The trigger is a real `<button>`, so it is reachable by keyboard (Tab) as
 *     well as hover.
 *   - The definition is wired to the trigger with `aria-describedby`, so a
 *     screen reader announces it on focus even while the panel is hidden.
 *   - The panel is shown on hover and on focus, and dismissed with `Escape`
 *     (which returns focus to the trigger), matching the tooltip behaviour
 *     expected across the app.
 */

import { useId, useState } from 'react';

export interface MetricDefinitionTipProps {
  /** The metric the definition belongs to; used for the accessible label. */
  title: string;
  /** Concise, accurate explanation of how the metric is computed. */
  definition: string;
}

/** Info glyph — purely decorative, hidden from assistive tech. */
function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3.5 w-3.5"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z"
        clipRule="evenodd"
      />
      <path d="M9 8h2v5H9zM9 5.5a1 1 0 112 0 1 1 0 01-2 0z" />
    </svg>
  );
}

export default function MetricDefinitionTip({
  title,
  definition,
}: MetricDefinitionTipProps) {
  const [open, setOpen] = useState(false);
  const tipId = useId();

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={`What is ${title}?`}
        aria-describedby={tipId}
        aria-expanded={open}
        data-testid="metric-definition-trigger"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
            e.currentTarget.blur();
          }
        }}
      >
        <InfoIcon />
      </button>

      {/* The definition is always in the DOM (so aria-describedby resolves even
          while collapsed) and only visually revealed when the tooltip is open. */}
      <span
        id={tipId}
        role="tooltip"
        data-testid="metric-definition"
        className={
          open
            ? 'absolute left-0 top-full z-20 mt-1 w-56 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-normal text-gray-600 shadow-md'
            : 'sr-only'
        }
      >
        {definition}
      </span>
    </span>
  );
}
