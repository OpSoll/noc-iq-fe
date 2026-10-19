import { create } from 'zustand';

/**
 * Persisted UI preferences (#1013).
 *
 * The page-size preference is stored in `localStorage` so a chosen page size
 * survives reloads. Previously the store held the value in memory only, so it
 * was reset on every navigation.
 *
 * The read path is defensive: a value that is missing, unparseable, non-numeric
 * or outside the supported set falls back to {@link DEFAULT_PAGE_SIZE} rather
 * than rendering an empty or broken table.
 */

/** Storage key for the persisted page-size preference. */
export const PAGE_SIZE_STORAGE_KEY = 'noc_preferences_page_size';

/** Fallback and initial page size. */
export const DEFAULT_PAGE_SIZE = 25;

/**
 * Page sizes offered by the UI. Only these are persisted, but any positive
 * integer is accepted so a future option does not need a store change.
 */
export const ALLOWED_PAGE_SIZES = [10, 25, 50, 100] as const;

export interface PreferenceState {
  pageSize: number;
  setPageSize: (size: number) => void;
  /** Re-read the persisted preference (used on mount / in tests). */
  hydrate: () => void;
}

/**
 * Parse a raw storage / caller value into a usable page size.
 * Returns `null` when the value is not a positive integer.
 */
export function parsePageSize(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const value = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

/** Reads the page size from storage, falling back to the default. */
export function readPersistedPageSize(): number {
  if (typeof window === 'undefined') return DEFAULT_PAGE_SIZE;
  try {
    return (
      parsePageSize(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY)) ??
      DEFAULT_PAGE_SIZE
    );
  } catch {
    // Storage can throw (private mode / disabled cookies); never break the UI.
    return DEFAULT_PAGE_SIZE;
  }
}

/** Persists the page size, ignoring storage failures. */
export function writePersistedPageSize(size: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(size));
  } catch {
    // Ignore: a preference that cannot be stored is not worth an error.
  }
}

export const usePreferenceStore = create<PreferenceState>((set) => ({
  // Hydrate lazily so the first render already has the stored value.
  pageSize: readPersistedPageSize(),

  setPageSize: (size) => {
    const parsed = parsePageSize(size);
    if (parsed === null) return;
    writePersistedPageSize(parsed);
    set({ pageSize: parsed });
  },

  hydrate: () => set({ pageSize: readPersistedPageSize() }),
}));
