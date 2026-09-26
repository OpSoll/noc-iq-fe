'use client';

import {
  EMPTY_DELIVERY_LOG_FILTERS,
  isDeliveryLogFilterActive,
  type DeliveryLogFilters,
  type DeliveryStatusCategory,
} from '@/lib/webhookDeliveryFilter';

export type { DeliveryLogFilters, DeliveryStatusCategory };
export { EMPTY_DELIVERY_LOG_FILTERS, isDeliveryLogFilterActive };

interface DeliverySearchFilterProps {
  filters: DeliveryLogFilters;
  onChange: (filters: DeliveryLogFilters) => void;
  /** Event topics offered by the event dropdown. Defaults to the four known topics. */
  events?: string[];
  /** Total deliveries before filtering (for the "Showing X of Y" count). */
  totalCount: number;
  /** Deliveries after filtering. */
  resultCount: number;
}

const DEFAULT_EVENTS = [
  'outage.created',
  'outage.resolved',
  'payment.processed',
  'sla.breached',
];

/**
 * Search and filter controls for the webhook delivery logs table (#674).
 *
 * Renders above the delivery history: a free-text search (event ID, URL, or
 * error text), an HTTP status-category dropdown (2xx / 4xx / 5xx), an event
 * topic dropdown, a date picker, and a clear button that restores the full
 * delivery log view.
 */
export function DeliverySearchFilter({
  filters,
  onChange,
  events = DEFAULT_EVENTS,
  totalCount,
  resultCount,
}: DeliverySearchFilterProps) {
  const active = isDeliveryLogFilterActive(filters);

  const set = (patch: Partial<DeliveryLogFilters>) =>
    onChange({ ...filters, ...patch });

  const clear = () => onChange({ ...EMPTY_DELIVERY_LOG_FILTERS });

  return (
    <div className="space-y-2" role="search" aria-label="Delivery log filters">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="delivery-log-search" className="sr-only">
            Search deliveries by event ID, URL, or error text
          </label>
          <input
            id="delivery-log-search"
            type="search"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Search by event ID, URL, or error…"
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <label className="sr-only" htmlFor="delivery-log-status">
          Filter by HTTP status category
        </label>
        <select
          id="delivery-log-status"
          value={filters.statusCategory}
          onChange={(e) =>
            set({ statusCategory: e.target.value as DeliveryStatusCategory })
          }
          className="rounded-md border-gray-300 py-1.5 text-xs focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="all">All statuses</option>
          <option value="2xx">Success (2xx)</option>
          <option value="4xx">Client error (4xx)</option>
          <option value="5xx">Server error (5xx)</option>
        </select>

        <label className="sr-only" htmlFor="delivery-log-event">
          Filter by event topic
        </label>
        <select
          id="delivery-log-event"
          value={filters.eventTopic}
          onChange={(e) => set({ eventTopic: e.target.value })}
          className="rounded-md border-gray-300 py-1.5 text-xs focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="all">All events</option>
          {events.map((ev) => (
            <option key={ev} value={ev}>
              {ev}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="delivery-log-date">
          Filter by date
        </label>
        <input
          id="delivery-log-date"
          type="date"
          value={filters.date}
          onChange={(e) => set({ date: e.target.value })}
          className="rounded-md border-gray-300 py-1.5 text-xs focus:border-blue-500 focus:ring-blue-500"
        />

        <button
          type="button"
          onClick={clear}
          disabled={!active}
          className="rounded-md border px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear
        </button>
      </div>

      <p className="text-[11px] text-gray-400" aria-live="polite">
        Showing {resultCount} of {totalCount} deliveries
        {active ? ' (filtered)' : ''}
      </p>
    </div>
  );
}
