'use client';

/**
 * useChartTheme
 *
 * Resolves the palette a hand-rolled chart should paint itself with, based on
 * the user's theme choice in `settingsStore` plus the OS colour-scheme
 * preference. Also promotes to the high-contrast palette when the browser
 * reports `forced-colors: active` or the app's a11y-high-contrast class is on
 * `<html>` (see `src/app/globals.css`).
 *
 * `window.matchMedia` and `document.documentElement` access is SSR-safe and
 * try/catch guarded, mirroring `prefersReducedMotion()` in
 * `src/components/ui/toast.tsx`, because jsdom and the test environment do not
 * provide `matchMedia`.
 *
 * Closes #608 – Dashboard: dark mode colour contrast optimization for charts
 */

import { useEffect, useState } from 'react';

import {
  resolveChartTheme,
  type ChartTheme,
  type ChartThemeMode,
} from '@/components/charts/chartTheme';
import { useSettingsStore } from '@/store/settingsStore';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const FORCED_COLORS_QUERY = '(forced-colors: active)';
const HIGH_CONTRAST_CLASS = 'a11y-high-contrast';

function matches(query: string): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

function hasClass(name: string): boolean {
  if (typeof document === 'undefined') return false;
  try {
    return document.documentElement.classList.contains(name);
  } catch {
    return false;
  }
}

/** True when dark mode is on, via the OS or the `<html class="dark">` flag. */
export function detectPrefersDark(): boolean {
  return matches(DARK_QUERY) || hasClass('dark');
}

/** True when the user has asked for (or the OS forces) maximum contrast. */
export function detectHighContrast(): boolean {
  return matches(FORCED_COLORS_QUERY) || hasClass(HIGH_CONTRAST_CLASS);
}

export interface UseChartThemeResult {
  /** Resolved token set for the current theme. */
  theme: ChartTheme;
  /** Mode actually applied, with `system` already collapsed. */
  mode: Exclude<ChartThemeMode, 'system'>;
  /** Re-runs the OS listeners; exposed for tests and manual refreshes. */
  refresh: () => void;
}

/** Returns the resolved {@link ChartTheme} for the active theme. */
export function useChartTheme(): UseChartThemeResult {
  const requested = useSettingsStore((state) => state.theme);
  const [systemPrefersDark, setSystemPrefersDark] = useState(detectPrefersDark);
  const [forcedHighContrast, setForcedHighContrast] = useState(
    detectHighContrast
  );

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }

    const sync = () => {
      setSystemPrefersDark(detectPrefersDark());
      setForcedHighContrast(detectHighContrast());
    };

    let dark: MediaQueryList | null = null;
    let forced: MediaQueryList | null = null;
    try {
      dark = window.matchMedia(DARK_QUERY);
      forced = window.matchMedia(FORCED_COLORS_QUERY);
    } catch {
      return;
    }

    dark.addEventListener('change', sync);
    forced.addEventListener('change', sync);

    // The in-app ThemeSwitcher toggles classes on <html> without a media
    // query change, so watch the class list too.
    const observer =
      typeof MutationObserver === 'function'
        ? new MutationObserver(sync)
        : null;
    observer?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    sync();

    return () => {
      dark?.removeEventListener('change', sync);
      forced?.removeEventListener('change', sync);
      observer?.disconnect();
    };
  }, []);

  const mode = forcedHighContrast
    ? 'high-contrast'
    : requested === 'system'
      ? systemPrefersDark
        ? 'dark'
        : 'light'
      : requested;

  return {
    theme: resolveChartTheme(mode, systemPrefersDark),
    mode,
    refresh: () => {
      setSystemPrefersDark(detectPrefersDark());
      setForcedHighContrast(detectHighContrast());
    },
  };
}

export default useChartTheme;
