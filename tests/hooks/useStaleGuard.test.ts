import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useStaleGuard } from "@/hooks/useStaleGuard";
import type { UseQueryResult } from "@tanstack/react-query";

function makeQueryResult(overrides: Partial<UseQueryResult<unknown, Error>> = {}): UseQueryResult<unknown, Error> {
  return {
    data: { value: "test" },
    isStale: false,
    isFetching: false,
    isLoading: false,
    isError: false,
    error: null,
    isSuccess: true,
    status: "success",
    fetchStatus: "idle",
    dataUpdatedAt: Date.now(),
    errorUpdateCount: 0,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    isFetched: true,
    isFetchedAfterMount: true,
    isInitialLoading: false,
    isPending: false,
    isPaused: false,
    isLoadingError: false,
    isPlaceholderData: false,
    isRefetchError: false,
    isRefetching: false,
    isStale: false,
    refetch: async () => ({} as never),
    remove: () => {},
    ...overrides,
  } as UseQueryResult<unknown, Error>;
}

describe("useStaleGuard", () => {
  it("passes data through when not stale", () => {
    const query = makeQueryResult({
      data: { value: "current" },
      isStale: false,
      isFetching: false,
    });

    const { result } = renderHook(() => useStaleGuard(query));
    expect(result.current.data).toEqual({ value: "current" });
    expect(result.current.isStale).toBe(false);
  });

  it("returns undefined for data when stale and fetching", () => {
    const query = makeQueryResult({
      data: { value: "old" },
      isStale: true,
      isFetching: true,
    });

    const { result } = renderHook(() => useStaleGuard(query));
    expect(result.current.data).toBeUndefined();
    expect(result.current.isStale).toBe(true);
    expect(result.current.isFetching).toBe(true);
  });

  it("returns data when stale but not fetching", () => {
    const query = makeQueryResult({
      data: { value: "cached" },
      isStale: true,
      isFetching: false,
    });

    const { result } = renderHook(() => useStaleGuard(query));
    expect(result.current.data).toEqual({ value: "cached" });
  });

  it("returns data when fetching but not stale", () => {
    const query = makeQueryResult({
      data: { value: "fresh" },
      isStale: false,
      isFetching: true,
    });

    const { result } = renderHook(() => useStaleGuard(query));
    expect(result.current.data).toEqual({ value: "fresh" });
  });

  it("preserves isLoading and isError states", () => {
    const loadingQuery = makeQueryResult({
      data: undefined,
      isLoading: true,
      isPending: true,
      isSuccess: false,
      status: "pending",
    });

    const { result: loadingResult } = renderHook(() => useStaleGuard(loadingQuery));
    expect(loadingResult.current.isLoading).toBe(true);
    expect(loadingResult.current.data).toBeUndefined();

    const errorQuery = makeQueryResult({
      data: undefined,
      isError: true,
      isSuccess: false,
      error: new Error("fetch failed"),
      status: "error",
    });

    const { result: errorResult } = renderHook(() => useStaleGuard(errorQuery));
    expect(errorResult.current.isError).toBe(true);
    expect(errorResult.current.error?.message).toBe("fetch failed");
  });
});
