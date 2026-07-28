import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDashboardLoading, type QueryResult } from "@/hooks/useDashboardLoading";

function makeQuery(overrides: Partial<QueryResult> = {}): QueryResult {
  return {
    isLoading: false,
    isError: false,
    isSuccess: true,
    ...overrides,
  };
}

describe("useDashboardLoading", () => {
  it("returns fully loaded with empty array", () => {
    const { result } = renderHook(() => useDashboardLoading([]));
    expect(result.current.isFullyLoaded).toBe(true);
    expect(result.current.progress).toBe(1);
    expect(result.current.loadedSections).toBe(0);
    expect(result.current.failedSections).toBe(0);
  });

  it("returns fully loaded when all queries succeed", () => {
    const queries = [
      makeQuery({ isSuccess: true }),
      makeQuery({ isSuccess: true }),
      makeQuery({ isSuccess: true }),
    ];
    const { result } = renderHook(() => useDashboardLoading(queries));
    expect(result.current.isFullyLoaded).toBe(true);
    expect(result.current.loadedSections).toBe(3);
    expect(result.current.failedSections).toBe(0);
    expect(result.current.progress).toBe(1);
  });

  it("reports partial failure without masking successes", () => {
    const queries = [
      makeQuery({ isSuccess: true }),
      makeQuery({ isError: true, isSuccess: false }),
      makeQuery({ isSuccess: true }),
    ];
    const { result } = renderHook(() => useDashboardLoading(queries));
    expect(result.current.isFullyLoaded).toBe(true);
    expect(result.current.loadedSections).toBe(2);
    expect(result.current.failedSections).toBe(1);
    expect(result.current.progress).toBeCloseTo(1);
  });

  it("shows incomplete progress while loading", () => {
    const queries = [
      makeQuery({ isSuccess: true }),
      makeQuery({ isLoading: true, isSuccess: false }),
    ];
    const { result } = renderHook(() => useDashboardLoading(queries));
    expect(result.current.isFullyLoaded).toBe(false);
    expect(result.current.progress).toBeCloseTo(0.5);
    expect(result.current.loadedSections).toBe(1);
    expect(result.current.failedSections).toBe(0);
  });

  it("calculates progress with mix of states", () => {
    const queries = [
      makeQuery({ isSuccess: true }),
      makeQuery({ isLoading: true, isSuccess: false }),
      makeQuery({ isError: true, isSuccess: false }),
    ];
    const { result } = renderHook(() => useDashboardLoading(queries));
    expect(result.current.isFullyLoaded).toBe(false);
    expect(result.current.progress).toBeCloseTo(2 / 3);
    expect(result.current.loadedSections).toBe(1);
    expect(result.current.failedSections).toBe(1);
  });
});
