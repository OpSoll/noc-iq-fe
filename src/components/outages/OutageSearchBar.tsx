'use client';

/**
 * OutageSearchBar
 *
 * Debounced full-text search input for the outages table. Keystrokes update the
 * input immediately so the caret never lags behind the keyboard, while the
 * filtered rows only react after DEBOUNCE_MS — one filter pass per pause
 * instead of one per character.
 *
 * Everything that decides *what* matches is a pure exported function
 * (createSearchMatcher / matchesSearchTerm / highlightMatches) so the filtering
 * and highlighting rules are unit tested without rendering the component.
 *
 * Closes #616 – Outage Table: Add full-text search filter input across outage
 * descriptions
 */

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Keystrokes are coalesced for this long before the table re-filters. */
export const DEBOUNCE_MS = 300;

// ─── Domain types ─────────────────────────────────────────────────────────────

/** One run of text produced by `highlightMatches`. */
export interface HighlightSegment {
  /** Raw slice of the source text with its original casing. */
  text: string;
  /** True when the slice matched one of the search terms. */
  match: boolean;
}

/** Minimal outage shape the search predicate needs. */
export interface SearchableOutage {
  /** Outage identifier, e.g. `outage-1`. */
  id: string;
  /** Site the outage was reported against. */
  site_name?: string;
  /** Compact label used by list views in place of `site_name`. */
  title?: string;
  /** Free-form incident description. */
  description?: string;
}

// ─── Search predicates (pure) ─────────────────────────────────────────────────

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Lower-cased, de-duplicated tokens of a search term. */
export function tokenizeSearchTerm(term: string): string[] {
  const tokens = term.toLowerCase().split(/\s+/).filter(Boolean);
  return Array.from(new Set(tokens));
}

/**
 * Builds a case-insensitive matcher for a single field. Multi-term queries are
 * ANDed — `"lagos fiber"` only matches text holding both tokens — and an empty
 * term matches everything so the unfiltered table stays visible.
 */
export function createSearchMatcher(term: string): (text: string) => boolean {
  const tokens = tokenizeSearchTerm(term);
  if (tokens.length === 0) return () => true;

  return (text: string): boolean => {
    const haystack = (text ?? '').toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  };
}

/**
 * Row-level predicate: every token has to appear somewhere on the outage
 * (ID, site name, compact title or description).
 */
export function matchesSearchTerm(
  row: SearchableOutage,
  term: string
): boolean {
  const tokens = tokenizeSearchTerm(term);
  if (tokens.length === 0) return true;

  const haystack = [row.id, row.site_name, row.title, row.description]
    .filter((field): field is string => typeof field === 'string')
    .join(' ')
    .toLowerCase();

  return tokens.every((token) => haystack.includes(token));
}

/** Splits `text` into alternating plain and matching segments. */
export function highlightMatches(
  text: string,
  term: string
): HighlightSegment[] {
  if (!text) return [];

  // Longest token first so "fiber" wins over "fib".
  const tokens = tokenizeSearchTerm(term).sort((a, b) => b.length - a.length);
  if (tokens.length === 0) return [{ text, match: false }];

  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'gi');
  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (const hit of text.matchAll(pattern)) {
    const start = hit.index ?? 0;
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), match: false });
    }
    segments.push({ text: hit[0], match: true });
    cursor = start + hit[0].length;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: false });
  }

  return segments;
}

/** Screen-reader phrasing for the "12 of 340 outages match" live region. */
export function formatResultSummary(
  resultCount: number,
  totalCount: number
): string {
  if (totalCount === 0) return 'No outages to search';
  const noun = resultCount === 1 ? 'outage matches' : 'outages match';
  return `${resultCount} of ${totalCount} ${noun}`;
}

// ─── Debounce hook ────────────────────────────────────────────────────────────

/** Returns `value` only after it has been stable for `delayMs` milliseconds. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

// ─── Highlight renderer ───────────────────────────────────────────────────────

export interface HighlightedTextProps {
  /** Text to render, possibly containing search matches. */
  text: string;
  /** Raw search term driving the highlighting. */
  term: string;
  /** Extra classes applied to the `<mark>` runs. */
  className?: string;
}

/**
 * Renders `text` with every search hit wrapped in `<mark>`. Plain text (no
 * term, or no match) is returned untouched so surrounding layout and existing
 * text queries keep working.
 */
export function HighlightedText({
  text,
  term,
  className,
}: HighlightedTextProps): ReactNode {
  const segments = highlightMatches(text, term);
  if (segments.length <= 1) return text;

  return segments.map((segment, index) =>
    segment.match ? (
      <mark
        key={`${segment.text}-${index}`}
        className={cn('rounded bg-yellow-100 px-0.5 text-slate-900', className)}
      >
        {segment.text}
      </mark>
    ) : (
      segment.text
    )
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface OutageSearchBarProps {
  /** Current search term (controlled). */
  value: string;
  /** Called with the debounced term, never on every keystroke. */
  onChange: (value: string) => void;
  /** Rows matching the current term; omit to hide the result count. */
  resultCount?: number;
  /** Rows before filtering; omit to hide the result count. */
  totalCount?: number;
  /** Input placeholder. */
  placeholder?: string;
  /** Debounce window in milliseconds. Defaults to DEBOUNCE_MS. */
  debounceMs?: number;
  /** Extra classes for the wrapper. */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * OutageSearchBar
 *
 * A labelled `type="search"` field with a clear button and an `aria-live`
 * result count. The value it reports is debounced by DEBOUNCE_MS, which is
 * what keeps the outages table from re-filtering on every character.
 */
export function OutageSearchBar({
  value,
  onChange,
  resultCount,
  totalCount,
  placeholder = 'Search by site, outage ID or description…',
  debounceMs = DEBOUNCE_MS,
  className,
}: OutageSearchBarProps) {
  const inputId = useId();
  const statusId = useId();

  const [draft, setDraft] = useState(value);
  const debounced = useDebouncedValue(draft, debounceMs);

  // Refs keep the debounce effect free of the parent's callback identity so a
  // re-render can never re-fire an already emitted term.
  const onChangeRef = useRef(onChange);
  const lastEmittedRef = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Adopt external resets such as the "Clear Search" empty-state action.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (debounced === lastEmittedRef.current) return;
    lastEmittedRef.current = debounced;
    onChangeRef.current(debounced);
  }, [debounced]);

  const hasCounts =
    typeof resultCount === 'number' && typeof totalCount === 'number';
  const summary = hasCounts
    ? formatResultSummary(resultCount, totalCount)
    : '';

  function handleClear() {
    setDraft('');
    if (lastEmittedRef.current === '') return;
    lastEmittedRef.current = '';
    onChangeRef.current('');
  }

  return (
    <div className={cn('w-full sm:max-w-sm', className)} role="search">
      <label htmlFor={inputId} className="sr-only">
        Search outages
      </label>

      <div className="relative">
        <input
          id={inputId}
          type="search"
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          aria-describedby={statusId}
          className={cn(
            'w-full rounded-md border border-slate-200 bg-white px-3 py-2',
            'pr-9 text-sm text-slate-900 placeholder:text-slate-400',
            'focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-blue-500'
          )}
        />

        {draft.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className={cn(
              'absolute right-1 top-1/2 -translate-y-1/2 rounded p-1',
              'text-base leading-none text-slate-400 hover:bg-slate-100',
              'hover:text-slate-700 focus-visible:outline-none',
              'focus-visible:ring-2 focus-visible:ring-blue-500'
            )}
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>

      <p id={statusId} role="status" aria-live="polite" className="sr-only">
        {summary}
      </p>
    </div>
  );
}
