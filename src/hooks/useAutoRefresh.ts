"use client";

import { useCallback, useEffect, useState } from "react";

// Closes #454: auto-refresh interval toggle for the dashboard header

export type AutoRefreshMs = 0 | 10_000 | 30_000 | 60_000;

export interface AutoRefreshOption {
  label: string;
  value: AutoRefreshMs;
}

export const AUTO_REFRESH_OPTIONS: AutoRefreshOption[] = [
  { label: "Off", value: 0 },
  { label: "10s", value: 10_000 },
  { label: "30s", value: 30_000 },
  { label: "60s", value: 60_000 },
];

export interface UseAutoRefreshResult {
  /** Selected interval in ms, 0 means "Off". */
  intervalMs: AutoRefreshMs;
  /** Update the selected interval. */
  setIntervalMs: (value: AutoRefreshMs) => void;
  /** Whether the browser tab is currently visible (Page Visibility API). */
  isTabVisible: boolean;
  /**
   * Value to hand straight to React Query's `refetchInterval`. Resolves to
   * `false` whenever polling is off or the tab is hidden, so refetches pause
   * automatically in background tabs.
   */
  refetchInterval: number | false;
  /** True when polling is enabled and actively running (tab visible). */
  isPolling: boolean;
}

/**
 * Drives the dashboard's auto-refresh select (10s / 30s / 60s / Off).
 *
 * Pauses polling whenever `document.visibilityState` is not `"visible"`,
 * per the Page Visibility API, and resumes automatically when the tab
 * regains focus.
 */
export function useAutoRefresh(
  defaultIntervalMs: AutoRefreshMs = 0,
): UseAutoRefreshResult {
  const [intervalMs, setIntervalMs] = useState<AutoRefreshMs>(defaultIntervalMs);
  const [isTabVisible, setIsTabVisible] = useState(() =>
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );

  useEffect(() => {
    if (typeof document === "undefined") return;

    function handleVisibilityChange() {
      setIsTabVisible(document.visibilityState === "visible");
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const setIntervalMsCallback = useCallback((value: AutoRefreshMs) => {
    setIntervalMs(value);
  }, []);

  const refetchInterval: number | false =
    intervalMs > 0 && isTabVisible ? intervalMs : false;

  return {
    intervalMs,
    setIntervalMs: setIntervalMsCallback,
    isTabVisible,
    refetchInterval,
    isPolling: intervalMs > 0 && isTabVisible,
  };
}
