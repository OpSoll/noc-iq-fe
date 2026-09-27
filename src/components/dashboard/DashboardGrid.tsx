'use client';

/**
 * DashboardGrid
 *
 * Reorderable, hideable shell for the SLA dashboard widgets. Ordering and
 * visibility are owned here, persisted automatically to a versioned
 * localStorage key, and exposed two ways: native HTML5 drag and drop plus an
 * equivalent keyboard path (Alt+Arrow, or the explicit Move up / Move down
 * buttons in the customize panel) because HTML5 DnD is not keyboard
 * operable.
 *
 * Closes #606
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { RotateCcwIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

// ─── Domain types ────────────────────────────────────────────────────────────

export interface DashboardWidget {
  /** Stable identity used for ordering, persistence, and show/hide. */
  id: string;
  /** Human-readable label shown in the customize panel. */
  title: string;
  /** Optional longer description, announced with the reorder handle. */
  description?: string;
  /** Renders the widget body. */
  render: () => ReactNode;
  /** Extra classes for this widget's cell (e.g. inner grid columns). */
  className?: string;
}

export interface DashboardLayout {
  /** Widget ids in display order. Unknown ids are tolerated. */
  order: string[];
  /** Widget ids the operator has hidden. */
  hidden: string[];
}

export interface DashboardGridProps {
  /** Widgets to render, in default order. */
  widgets: DashboardWidget[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Bumped when the persisted shape changes; older payloads are dropped. */
export const LAYOUT_VERSION = 1;

export const LAYOUT_STORAGE_KEY = 'dashboard_layout_v1';

/**
 * Baseline layout: an empty order means "use the order the widgets prop came
 * in" and an empty hidden set means "show everything".
 */
export const DEFAULT_ORDER: readonly string[] = Object.freeze([]);

export const DEFAULT_LAYOUT: DashboardLayout = {
  order: [...DEFAULT_ORDER],
  hidden: [],
};

interface SerializedLayout {
  version: number;
  order: string[];
  hidden: string[];
}

// ─── Pure layout helpers ─────────────────────────────────────────────────────

/** Derives the default layout for a concrete widget list. */
export function defaultLayoutFor(widgetIds: string[]): DashboardLayout {
  return { order: [...widgetIds], hidden: [] };
}

/**
 * Returns `order` with every unknown or duplicated id removed and every id
 * missing from `order` appended in `ids` order. This is what keeps a stale
 * persisted layout from making a widget unreachable.
 */
export function normalizeOrder(order: string[], ids: string[]): string[] {
  const known = new Set(ids);
  const seen = new Set<string>();
  const next: string[] = [];

  for (const id of order) {
    if (known.has(id) && !seen.has(id)) {
      next.push(id);
      seen.add(id);
    }
  }
  for (const id of ids) {
    if (!seen.has(id)) next.push(id);
  }
  return next;
}

/**
 * Moves the entry at `from` to `to`, returning a new array. Out-of-range or
 * no-op indices return the original array untouched.
 */
export function moveWidget(
  order: string[],
  from: number,
  to: number
): string[] {
  if (from === to) return order;
  if (from < 0 || from >= order.length) return order;
  if (to < 0 || to >= order.length) return order;

  const next = [...order];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function serializeLayout(state: DashboardLayout): string {
  const payload: SerializedLayout = {
    version: LAYOUT_VERSION,
    order: [...state.order],
    // Sorted so an unchanged hidden set always serializes identically.
    hidden: [...state.hidden].sort(),
  };
  return JSON.stringify(payload);
}

/**
 * Rebuilds a layout from stored JSON.
 *
 * Defensive by design: unreadable JSON, a non-object payload, or a payload
 * written by a different `LAYOUT_VERSION` all fall back to `defaults`, and
 * any payload that survives parsing has unknown ids dropped and missing ids
 * re-appended.
 */
export function deserializeLayout(
  raw: string | null | undefined,
  defaults: DashboardLayout
): DashboardLayout {
  const fallback: DashboardLayout = {
    order: [...defaults.order],
    hidden: [...defaults.hidden],
  };
  if (!raw) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (typeof parsed !== 'object' || parsed === null) return fallback;

  const candidate = parsed as Partial<SerializedLayout>;
  if (candidate.version !== LAYOUT_VERSION) return fallback;

  const known = new Set(defaults.order);
  const order = Array.isArray(candidate.order)
    ? candidate.order.filter(
        (id): id is string => typeof id === 'string' && known.has(id)
      )
    : [];
  const hidden = Array.isArray(candidate.hidden)
    ? [
        ...new Set(
          candidate.hidden.filter(
            (id): id is string => typeof id === 'string' && known.has(id)
          )
        ),
      ]
    : [];

  return { order: normalizeOrder(order, defaults.order), hidden };
}

// ─── Storage helpers ─────────────────────────────────────────────────────────

export function readStoredLayout(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(LAYOUT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredLayout(state: DashboardLayout): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, serializeLayout(state));
  } catch {
    // Private-mode / blocked storage: the layout is session-only.
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DashboardGrid({ widgets }: DashboardGridProps) {
  const panelId = useId();
  const [layout, setLayout] = useState<DashboardLayout>(DEFAULT_LAYOUT);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // `widgetIds` is a fresh array on every render, so derive a stable key for
  // the memo/effect deps instead of depending on the array identity.
  const widgetIdKey = widgets.map((widget) => widget.id).join('|');
  const widgetIds = useMemo(
    () => widgetIdKey.split('|').filter(Boolean),
    [widgetIdKey]
  );

  // Stored in a ref so the load effect can stay mount-only: later widget-list
  // changes are normalized by the `order` memo instead of reloading storage.
  const initialWidgetIdsRef = useRef<string[]>(widgetIds);

  useEffect(() => {
    // Loaded after mount rather than in the state initializer so the server
    // render and the first client render always agree (no hydration mismatch).
    setLayout(
      deserializeLayout(
        readStoredLayout(),
        defaultLayoutFor(initialWidgetIdsRef.current)
      )
    );
    setIsHydrated(true);
  }, []);

  const order = useMemo(
    () => normalizeOrder(layout.order, widgetIds),
    [layout.order, widgetIds]
  );

  const hidden = useMemo(
    () => layout.hidden.filter((id) => widgetIds.includes(id)),
    [layout.hidden, widgetIds]
  );

  useEffect(() => {
    if (!isHydrated) return;
    writeStoredLayout({ order, hidden });
  }, [isHydrated, order, hidden]);

  const widgetById = new Map<string, DashboardWidget>();
  for (const widget of widgets) widgetById.set(widget.id, widget);

  const visibleWidgets = order
    .filter((id) => !hidden.includes(id))
    .map((id) => widgetById.get(id))
    .filter((widget): widget is DashboardWidget => Boolean(widget));

  const commitOrder = useCallback(
    (from: number, to: number) => {
      setLayout((prev) => ({
        ...prev,
        order: moveWidget(normalizeOrder(prev.order, widgetIds), from, to),
      }));
    },
    [widgetIds]
  );

  const toggleWidget = useCallback((id: string) => {
    setLayout((prev) => ({
      ...prev,
      hidden: prev.hidden.includes(id)
        ? prev.hidden.filter((hiddenId) => hiddenId !== id)
        : [...prev.hidden, id],
    }));
  }, []);

  function resetLayout() {
    setLayout(defaultLayoutFor(widgetIds));
  }

  function handleDrop(targetId: string) {
    if (draggingId && draggingId !== targetId) {
      commitOrder(order.indexOf(draggingId), order.indexOf(targetId));
    }
    setDraggingId(null);
    setDragOverId(null);
  }

  function handleHandleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    id: string
  ) {
    if (!event.altKey) return;
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const index = order.indexOf(id);
    commitOrder(index, index + (event.key === 'ArrowUp' ? -1 : 1));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-gray-400">
          Dashboard widgets
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={resetLayout}
          >
            <RotateCcwIcon />
            Reset Layout
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-expanded={isPanelOpen}
            aria-controls={panelId}
            onClick={() => setIsPanelOpen((open) => !open)}
          >
            {isPanelOpen ? 'Done' : 'Customize'}
          </Button>
        </div>
      </div>

      {isPanelOpen ? (
        <div
          id={panelId}
          className="rounded-xl border border-slate-200 bg-slate-50 p-3"
        >
          <p className="mb-2 text-xs text-slate-500">
            Drag a widget by its handle, or focus the handle and press Alt +
            Arrow Up / Arrow Down, to reorder. Tick a widget to hide it.
          </p>
          <ul className="space-y-2">
            {order.map((id, index) => {
              const widget = widgetById.get(id);
              if (!widget) return null;
              const inputId = `${panelId}-${id}`;
              return (
                <li
                  key={id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <button
                    type="button"
                    draggable
                    onDragStart={() => setDraggingId(id)}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverId(null);
                    }}
                    onKeyDown={(event) => handleHandleKeyDown(event, id)}
                    aria-label={`Reorder ${widget.title}. Alt plus arrow up or arrow down moves the widget.`}
                    className="cursor-grab rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <GripVertical className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <label
                    htmlFor={inputId}
                    className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-700"
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={!hidden.includes(id)}
                      onChange={() => toggleWidget(id)}
                      className="h-4 w-4 shrink-0 rounded border-slate-300"
                    />
                    <span className="truncate">{widget.title}</span>
                  </label>
                  <span className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label={`Move ${widget.title} up`}
                      disabled={index === 0}
                      onClick={() => commitOrder(index, index - 1)}
                    >
                      <ChevronUp aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label={`Move ${widget.title} down`}
                      disabled={index === order.length - 1}
                      onClick={() => commitOrder(index, index + 1)}
                    >
                      <ChevronDown aria-hidden="true" />
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="space-y-6">
        {visibleWidgets.map((widget) => (
          <section
            key={widget.id}
            data-widget-id={widget.id}
            aria-label={widget.title}
            onDragOver={(event) => {
              if (!draggingId) return;
              event.preventDefault();
              if (dragOverId !== widget.id) setDragOverId(widget.id);
            }}
            onDragLeave={(event) => {
              // Ignore the event while the pointer is still inside the cell so
              // dragging over a child element does not clear the indicator.
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setDragOverId(null);
              }
            }}
            onDrop={(event) => {
              if (!draggingId) return;
              event.preventDefault();
              handleDrop(widget.id);
            }}
            className={cn(
              'rounded-xl transition-shadow',
              draggingId === widget.id && 'opacity-50',
              dragOverId === widget.id &&
                draggingId !== widget.id &&
                'ring-2 ring-blue-400',
              widget.className
            )}
          >
            {widget.render()}
          </section>
        ))}
      </div>
    </div>
  );
}

export default DashboardGrid;
