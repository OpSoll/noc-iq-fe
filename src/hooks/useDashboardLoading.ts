"use client";

import { useMemo } from "react";

export interface QueryResult {
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  error?: unknown;
}

export interface DashboardLoadingState {
  isFullyLoaded: boolean;
  loadedSections: number;
  failedSections: number;
  progress: number;
}

export function useDashboardLoading(queries: QueryResult[]): DashboardLoadingState {
  return useMemo(() => {
    const total = queries.length;
    if (total === 0) {
      return { isFullyLoaded: true, loadedSections: 0, failedSections: 0, progress: 1 };
    }

    const loaded = queries.filter((q) => q.isSuccess).length;
    const failed = queries.filter((q) => q.isError).length;
    const active = queries.filter((q) => q.isLoading).length;

    const progress = total > 0 ? (loaded + failed) / total : 1;

    return {
      isFullyLoaded: active === 0,
      loadedSections: loaded,
      failedSections: failed,
      progress,
    };
  }, [queries]);
}
