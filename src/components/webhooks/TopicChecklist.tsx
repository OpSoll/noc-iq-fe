'use client';

import { useMemo } from 'react';

import {
  findUnknownTopics,
  normalizeTopics,
  WEBHOOK_EVENTS,
} from '@/lib/webhookEvents';
import { cn } from '@/lib/utils';

/**
 * Checkbox list for choosing which event topics a webhook subscribes to.
 *
 * Subscribing used to mean typing a string array, which is where typos get in
 * — an unrecognised topic is silently accepted and then never fires. This
 * component only ever emits canonical topic strings, and surfaces any
 * pre-existing unknown topics instead of quietly dropping them.
 *
 * Closes #669 — topic subscription selector checklist component.
 */

export interface TopicChecklistProps {
  /** Currently selected topics; unknown values are tolerated and flagged. */
  value: string[];
  onChange: (topics: string[]) => void;
  className?: string;
  disabled?: boolean;
}

export default function TopicChecklist({
  value,
  onChange,
  className,
  disabled = false,
}: TopicChecklistProps) {
  const selected = useMemo(() => new Set(normalizeTopics(value)), [value]);
  const unknown = useMemo(() => findUnknownTopics(value), [value]);
  const allSelected = selected.size === WEBHOOK_EVENTS.length;

  const toggle = (topic: string) => {
    const next = new Set(selected);
    if (next.has(topic)) next.delete(topic);
    else next.add(topic);
    onChange(WEBHOOK_EVENTS.map((e) => e.topic).filter((t) => next.has(t)));
  };

  return (
    <fieldset
      disabled={disabled}
      className={cn('rounded-lg border border-slate-200 p-3', className)}
    >
      <legend className="px-1 text-sm font-medium text-slate-700">
        Event topics
      </legend>

      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(WEBHOOK_EVENTS.map((e) => e.topic))}
          disabled={disabled || allSelected}
          data-testid="topic-select-all"
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Select All
        </button>
        <button
          type="button"
          onClick={() => onChange([])}
          disabled={disabled || selected.size === 0}
          data-testid="topic-deselect-all"
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Deselect All
        </button>
        <span className="ml-auto text-xs text-slate-500" aria-live="polite">
          {selected.size} of {WEBHOOK_EVENTS.length} selected
        </span>
      </div>

      <ul className="space-y-1">
        {WEBHOOK_EVENTS.map((event) => (
          <li key={event.topic}>
            <label
              data-testid={`topic-option-${event.topic}`}
              className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.has(event.topic)}
                onChange={() => toggle(event.topic)}
                disabled={disabled}
                data-testid={`topic-checkbox-${event.topic}`}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
              />
              <span className="min-w-0">
                <span className="block text-sm text-slate-800">
                  {event.label}
                </span>
                <span className="block font-mono text-xs text-slate-400">
                  {event.topic}
                </span>
                {/* Tooltip carries the event's purpose, as the issue requires. */}
                <span
                  title={event.description}
                  data-testid={`topic-description-${event.topic}`}
                  className="sr-only"
                >
                  {event.description}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {unknown.length > 0 && (
        <p
          role="status"
          data-testid="topic-unknown-warning"
          className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800"
        >
          Ignoring unrecognised topic{unknown.length === 1 ? '' : 's'}:{' '}
          <span className="font-mono">{unknown.join(', ')}</span>
        </p>
      )}
    </fieldset>
  );
}
