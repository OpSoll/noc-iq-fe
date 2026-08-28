import { act, renderHook } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { AUTO_REFRESH_OPTIONS, useAutoRefresh } from "./useAutoRefresh";

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("AUTO_REFRESH_OPTIONS", () => {
  it("exposes Off, 10s, 30s, 60s options", () => {
    expect(AUTO_REFRESH_OPTIONS.map((o) => o.label)).toEqual(["Off", "10s", "30s", "60s"]);
    expect(AUTO_REFRESH_OPTIONS.map((o) => o.value)).toEqual([0, 10_000, 30_000, 60_000]);
  });
});

describe("useAutoRefresh", () => {
  afterEach(() => {
    setVisibility("visible");
  });

  it("defaults to Off (refetchInterval false)", () => {
    const { result } = renderHook(() => useAutoRefresh());
    expect(result.current.intervalMs).toBe(0);
    expect(result.current.refetchInterval).toBe(false);
    expect(result.current.isPolling).toBe(false);
  });

  it("returns the selected interval as refetchInterval when the tab is visible", () => {
    const { result } = renderHook(() => useAutoRefresh());
    act(() => result.current.setIntervalMs(30_000));
    expect(result.current.intervalMs).toBe(30_000);
    expect(result.current.refetchInterval).toBe(30_000);
    expect(result.current.isPolling).toBe(true);
  });

  it("pauses (refetchInterval=false) when the tab becomes hidden", () => {
    const { result } = renderHook(() => useAutoRefresh(10_000));
    expect(result.current.refetchInterval).toBe(10_000);

    act(() => setVisibility("hidden"));

    expect(result.current.isTabVisible).toBe(false);
    expect(result.current.refetchInterval).toBe(false);
    expect(result.current.isPolling).toBe(false);
  });

  it("resumes polling once the tab becomes visible again", () => {
    const { result } = renderHook(() => useAutoRefresh(60_000));

    act(() => setVisibility("hidden"));
    expect(result.current.refetchInterval).toBe(false);

    act(() => setVisibility("visible"));
    expect(result.current.refetchInterval).toBe(60_000);
    expect(result.current.isPolling).toBe(true);
  });

  it("stays off while hidden even if an interval is selected", () => {
    const { result } = renderHook(() => useAutoRefresh());
    act(() => setVisibility("hidden"));
    act(() => result.current.setIntervalMs(10_000));
    expect(result.current.refetchInterval).toBe(false);
  });
});
