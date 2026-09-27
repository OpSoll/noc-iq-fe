'use client';

/**
 * ColumnToggle
 *
 * Show/hide control for a table's columns, remembered per browser via
 * `localStorage` so a reloaded report keeps the layout the operator chose.
 *
 * Design notes
 * ────────────
 * • The component is *controlled*: it never invents the visible set, it only
 *   reports the next one through `onChange`. The table owns the TanStack
 *   `columnVisibility` state and stays the single source of truth.
 * • Hydration runs once (guarded by a ref) and reports the stored set upward;
 *   reading `localStorage` lazily in `useState` would break under SSR.
 * • At least one column always stays visible — an empty table is never a
 *   useful state, so the last checkbox is refused and the reason is announced.
 * • Radix's `DropdownMenuCheckboxItem` gives `role="menuitemcheckbox"` with
 *   `aria-checked` for free, and `onSelect` is prevented from closing the menu
 *   so several columns can be toggled in one visit.
 *
 * Closes #619 – Outage Table: Add column visibility toggle with persistence
 */

import { useEffect, useRef, useState } from 'react';
import { ColumnsIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// ─── Domain types ─────────────────────────────────────────────────────────────

/** One selectable column. `id` must match the table's column id. */
export interface ColumnOption {
  id: string;
  label: string;
}

/** `localStorage` key used when the caller does not supply one. */
export const DEFAULT_COLUMN_STORAGE_KEY = 'noc:table:columns';

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Reads a stored column list. Unknown ids are dropped, duplicates removed and
 * the result is returned in `known` order so the table columns never shuffle.
 * `null` means "nothing usable stored", i.e. fall back to the defaults.
 */
export function parseStoredColumns(
  raw: string | null,
  known: string[]
): string[] | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) return null;

  const wanted = new Set(
    parsed.filter((id): id is string => typeof id === 'string')
  );
  const usable = known.filter((id) => wanted.has(id));

  return usable.length > 0 ? usable : null;
}

/** Serialises the visible set for storage. */
export function serializeColumns(visible: string[]): string {
  return JSON.stringify(visible);
}

/**
 * Flips one column. Hiding the only visible column is refused so the table can
 * never end up without headers.
 */
export function toggleColumn(visible: string[], id: string): string[] {
  if (!visible.includes(id)) return [...visible, id];
  if (visible.length === 1) return visible;
  return visible.filter((entry) => entry !== id);
}

/** Sentence announced after a change, e.g. "3 of 4 columns visible." */
export function formatVisibilitySummary(
  visible: string[],
  total: number
): string {
  const plural = total === 1 ? '' : 's';
  return `${visible.length} of ${total} column${plural} visible.`;
}

/** Reads storage without throwing when it is unavailable or full. */
export function readStoredColumns(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Persists the visible set, silently ignoring a full or blocked store. */
export function writeStoredColumns(key: string, visible: string[]): void {
  try {
    window.localStorage.setItem(key, serializeColumns(visible));
  } catch {
    // Private browsing or a full quota must not break the table.
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ColumnToggleProps {
  /** Every column the table can show. */
  columns: ColumnOption[];
  /** Column ids currently rendered, in table order. */
  visible: string[];
  /** Receives the next visible set whenever the operator toggles. */
  onChange: (visible: string[]) => void;
  /** `localStorage` key; defaults to DEFAULT_COLUMN_STORAGE_KEY. */
  storageKey?: string;
  /** Trigger text; defaults to "Columns". */
  label?: string;
  /** Extra classes for the wrapper. */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ColumnToggle
 *
 * A Radix dropdown of checkboxes. Every item is reachable with Arrow keys and
 * toggled with Enter or Space, and the result is mirrored into a polite live
 * region so the change is announced, not just drawn.
 */
export function ColumnToggle({
  columns,
  visible,
  onChange,
  storageKey = DEFAULT_COLUMN_STORAGE_KEY,
  label = 'Columns',
  className,
}: ColumnToggleProps) {
  const known = columns.map((column) => column.id);

  // Latest props, so the one-shot hydration effect below can read them without
  // re-running on every render.
  const latest = useRef({ visible, onChange, storageKey, known });
  latest.current = { visible, onChange, storageKey, known };

  const [summary, setSummary] = useState(() =>
    formatVisibilitySummary(visible, known.length)
  );

  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;

    const stored = parseStoredColumns(
      readStoredColumns(latest.current.storageKey),
      latest.current.known
    );
    if (stored) {
      setSummary(formatVisibilitySummary(stored, latest.current.known.length));
      latest.current.onChange(stored);
    }
  }, []);

  function handleToggle(id: string) {
    const current = latest.current.visible;
    const next = toggleColumn(current, id);

    if (next.length === current.length) {
      setSummary('At least one column must stay visible.');
      return;
    }

    writeStoredColumns(latest.current.storageKey, next);
    setSummary(formatVisibilitySummary(next, known.length));
    latest.current.onChange(next);
  }

  return (
    <div className={cn('flex items-center', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-haspopup="menu"
            className="gap-2"
          >
            <ColumnsIcon className="h-4 w-4" />
            {label}
            <span aria-hidden="true" className="text-xs text-slate-500">
              {visible.length}/{known.length}
            </span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-xs text-slate-500">
            Toggle columns
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {columns.map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={visible.includes(column.id)}
              onCheckedChange={() => handleToggle(column.id)}
              onSelect={(event) => event.preventDefault()}
            >
              {column.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <p role="status" aria-live="polite" className="sr-only">
        {summary}
      </p>
    </div>
  );
}
