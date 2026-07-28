import { act, renderHook } from "@testing-library/react";
import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";

import { useReplayGuard } from "@/hooks/useReplayGuard";

describe("useReplayGuard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("default cooldown (10s)", () => {
    it("allows replay when no previous replay exists", () => {
      const { result } = renderHook(() => useReplayGuard());

      const state = result.current.checkReplay("webhook-1");

      expect(state.canReplay).toBe(true);
      expect(state.lastReplayAt).toBeNull();
      expect(state.remainingCooldownMs).toBe(0);
    });

    it("blocks duplicate replay within cooldown period", () => {
      const { result } = renderHook(() => useReplayGuard());

      // Mark as replayed
      act(() => {
        result.current.markReplayed("webhook-1");
      });

      // Check immediately
      const state = result.current.checkReplay("webhook-1");

      expect(state.canReplay).toBe(false);
      expect(state.lastReplayAt).not.toBeNull();
      expect(state.remainingCooldownMs).toBeGreaterThan(0);
      expect(state.remainingCooldownMs).toBeLessThanOrEqual(10_000);
    });

    it("allows replay after cooldown elapses", () => {
      const { result } = renderHook(() => useReplayGuard());

      act(() => {
        result.current.markReplayed("webhook-1");
      });

      // Advance time past the 10s cooldown
      act(() => {
        vi.advanceTimersByTime(10_000);
      });

      const state = result.current.checkReplay("webhook-1");

      expect(state.canReplay).toBe(true);
      expect(state.remainingCooldownMs).toBe(0);
    });

    it("remainingCooldownMs decreases over time", () => {
      const { result } = renderHook(() => useReplayGuard());

      act(() => {
        result.current.markReplayed("webhook-1");
      });

      // After 3s, cooldown should be ~7s remaining
      act(() => {
        vi.advanceTimersByTime(3_000);
      });

      const state = result.current.checkReplay("webhook-1");
      expect(state.remainingCooldownMs).toBeCloseTo(7_000, -2); // within 100ms
    });
  });

  describe("custom cooldown", () => {
    it("uses custom cooldown value", () => {
      const { result } = renderHook(() => useReplayGuard(60_000));

      act(() => {
        result.current.markReplayed("webhook-1");
      });

      // At 50s, still not ready
      act(() => {
        vi.advanceTimersByTime(50_000);
      });

      expect(result.current.checkReplay("webhook-1").canReplay).toBe(false);

      // After 60s, ready
      act(() => {
        vi.advanceTimersByTime(10_000);
      });

      expect(result.current.checkReplay("webhook-1").canReplay).toBe(true);
    });

    it("zero cooldown allows immediate replay", () => {
      const { result } = renderHook(() => useReplayGuard(0));

      act(() => {
        result.current.markReplayed("webhook-1");
      });

      expect(result.current.checkReplay("webhook-1").canReplay).toBe(true);
    });
  });

  describe("per-webhook independence", () => {
    it("different webhook IDs are independent", () => {
      const { result } = renderHook(() => useReplayGuard());

      act(() => {
        result.current.markReplayed("webhook-1");
      });

      // webhook-2 should still be available
      expect(result.current.checkReplay("webhook-1").canReplay).toBe(false);
      expect(result.current.checkReplay("webhook-2").canReplay).toBe(true);
      expect(result.current.checkReplay("webhook-3").canReplay).toBe(true);
    });
  });

  describe("attemptReplay", () => {
    it("returns ok: true when replay is allowed", () => {
      const { result } = renderHook(() => useReplayGuard());

      const outcome = result.current.attemptReplay({
        webhookId: "webhook-1",
        timestamp: "2026-01-01T00:00:00Z",
      });

      expect(outcome.ok).toBe(true);
      expect(outcome.reason).toBeUndefined();
    });

    it("returns ok: false with reason when cooldown is active", () => {
      const { result } = renderHook(() => useReplayGuard());

      // First attempt
      result.current.attemptReplay({
        webhookId: "webhook-1",
        timestamp: "2026-01-01T00:00:00Z",
      });

      // Second attempt immediately after
      const outcome = result.current.attemptReplay({
        webhookId: "webhook-1",
        timestamp: "2026-01-01T00:00:01Z",
      });

      expect(outcome.ok).toBe(false);
      expect(outcome.reason).toContain("Cooldown active");
      expect(outcome.reason).toContain("ms");
    });

    it("updates lastReplayAt on successful attempt", () => {
      const { result } = renderHook(() => useReplayGuard());

      result.current.attemptReplay({
        webhookId: "webhook-1",
        timestamp: "2026-01-01T00:00:00Z",
      });

      const state = result.current.checkReplay("webhook-1");
      expect(state.lastReplayAt).not.toBeNull();
    });
  });

  describe("edge cases", () => {
    it("handles empty webhookId", () => {
      const { result } = renderHook(() => useReplayGuard());

      const outcome = result.current.attemptReplay({
        webhookId: "",
        timestamp: "2026-01-01T00:00:00Z",
      });

      expect(outcome.ok).toBe(true);

      // Second attempt with same empty id should be blocked
      const second = result.current.attemptReplay({
        webhookId: "",
        timestamp: "2026-01-01T00:00:01Z",
      });
      expect(second.ok).toBe(false);
    });

    it("markReplayed then checkReplay shows correct lastReplayAt format", () => {
      const { result } = renderHook(() => useReplayGuard());

      act(() => {
        result.current.markReplayed("webhook-1");
      });

      const state = result.current.checkReplay("webhook-1");
      expect(state.lastReplayAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      );
    });
  });
});
