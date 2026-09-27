'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useFocusTrap } from '@/hooks/useFocusTrap';
import {
  buildCommandSet,
  nextIndex,
  searchCommands,
  type CommandItem,
  type RankedCommand,
} from '@/lib/commandPalette';
import { cn } from '@/lib/utils';

/**
 * Global command palette opened with Cmd+K / Ctrl+K.
 *
 * Navigation between outages, payments, webhooks, and settings otherwise costs
 * several clicks per destination, and there is no way to jump straight to a
 * specific outage or site. Fully keyboard-driven: type to filter, arrows to
 * move, Enter to run, Escape to dismiss.
 *
 * Closes #675 — Cmd+K / Ctrl+K global command palette search modal.
 */

export interface CommandPaletteProps {
  outages?: Array<{ id: string; siteId?: string | null; severity?: string | null }>;
  sites?: Array<{ id: string; name?: string | null }>;
  extraCommands?: CommandItem[];
  /** Controlled open state; omit to let the component own the shortcut. */
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const GROUP_ORDER = [
  'Navigation',
  'Actions',
  'Outages',
  'Sites',
  'Payments',
] as const;

export default function CommandPalette({
  outages,
  sites,
  extraCommands,
  isOpen: controlledOpen,
  onOpenChange,
}: CommandPaletteProps) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = controlledOpen ?? uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange]
  );

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands = useMemo(
    () => buildCommandSet({ outages, sites, extraCommands }),
    [outages, sites, extraCommands]
  );
  const results = useMemo(
    () => searchCommands(commands, query),
    [commands, query]
  );

  // Keep the highlight in range as the result set changes size.
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Global Cmd+K / Ctrl+K from anywhere in the app.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(!isOpen);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, setOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useFocusTrap(panelRef, isOpen, () => setOpen(false));

  const run = useCallback(
    (command: RankedCommand) => {
      if (command.href) router.push(command.href);
      setOpen(false);
    },
    [router, setOpen]
  );

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex((i) => nextIndex(i, 1, results.length));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex((i) => nextIndex(i, -1, results.length));
        break;
      case 'Home':
        event.preventDefault();
        setSelectedIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setSelectedIndex(Math.max(0, results.length - 1));
        break;
      case 'Enter': {
        event.preventDefault();
        const command = results[selectedIndex];
        if (command) run(command);
        break;
      }
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        break;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[10vh]"
      onClick={() => setOpen(false)}
      data-backdrop=""
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        data-testid="command-palette"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <label htmlFor="command-palette-input" className="sr-only">
          Search commands, outages, and sites
        </label>
        <input
          id="command-palette-input"
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search commands, outages, and sites…"
          role="combobox"
          aria-expanded="true"
          aria-controls={listboxId}
          aria-activedescendant={
            results[selectedIndex]
              ? `${listboxId}-${results[selectedIndex].id}`
              : undefined
          }
          data-testid="command-palette-input"
          className="w-full border-b border-slate-200 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
        />

        {results.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">
            No matches for “{query}”.
          </p>
        ) : (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Commands"
            data-testid="command-palette-results"
            className="max-h-80 overflow-y-auto py-1"
          >
            {groupResults(results).map(({ group, items }) => (
              <li key={group} role="presentation">
                <p
                  role="presentation"
                  className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                >
                  {group}
                </p>
                <ul role="group" aria-label={group}>
                  {items.map(({ command, index }) => (
                    <li key={command.id} role="presentation">
                      <button
                        type="button"
                        id={`${listboxId}-${command.id}`}
                        role="option"
                        aria-selected={index === selectedIndex}
                        onClick={() => run(command)}
                        onMouseMove={() => setSelectedIndex(index)}
                        data-testid="command-palette-option"
                        data-command-id={command.id}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-2 text-left text-sm',
                          index === selectedIndex
                            ? 'bg-indigo-50 text-indigo-900'
                            : 'text-slate-700 hover:bg-slate-50'
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {command.label}
                        </span>
                        {command.hint && (
                          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                            {command.hint}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
          <span className="ml-auto font-mono">Cmd/Ctrl + K</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Groups results while preserving rank order within each group.
 *
 * `index` is the position in the flat, rank-ordered list — that is what the
 * keyboard highlight tracks, so grouping for display must not renumber it.
 */
function groupResults(
  results: RankedCommand[]
): Array<{ group: string; items: Array<{ command: RankedCommand; index: number }> }> {
  const groups = new Map<string, Array<{ command: RankedCommand; index: number }>>();

  results.forEach((command, index) => {
    const existing = groups.get(command.group);
    if (existing) existing.push({ command, index });
    else groups.set(command.group, [{ command, index }]);
  });

  return GROUP_ORDER.filter((group) => groups.has(group))
    .map((group) => ({ group, items: groups.get(group)! }))
    .concat(
      Array.from(groups.entries())
        .filter(([group]) => !(GROUP_ORDER as readonly string[]).includes(group))
        .map(([group, items]) => ({ group, items }))
    );
}
