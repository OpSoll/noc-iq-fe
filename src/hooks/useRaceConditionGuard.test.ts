import { act, renderHook } from "@testing-library/react";
import { describe, it, beforeEach, expect, vi } from "vitest";

import { useRaceConditionGuard } from "@/hooks/useRaceConditionGuard";

describe("useRaceConditionGuard", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  describe("initial state", () => {
    it("starts in idle state", () => {
      const { result } = renderHook(() => useRaceConditionGuard());

      expect(result.current.state).toBe("idle");
    });

    it("reset does nothing when already idle", () => {
      const { result } = renderHook(() => useRaceConditionGuard());

      act(() => {
        result.current.reset();
      });

      expect(result.current.state).toBe("idle");
    });
  });

  describe("execute lifecycle", () => {
    it("transitions to pending when execute is called", async () => {
      const { result } = renderHook(() => useRaceConditionGuard());

      let promise!: Promise<string>;
      act(() => {
        promise = result.current.execute(() => Promise.resolve("done"));
      });

      expect(result.current.state).toBe("pending");

      await act(async () => {
        await promise;
      });
    });

    it("transitions to resolved on successful execution", async () => {
      const { result } = renderHook(() => useRaceConditionGuard());

      await act(async () => {
        await result.current.execute(() => Promise.resolve("success"));
      });

      expect(result.current.state).toBe("resolved");
    });

    it("returns the resolved value", async () => {
      const { result } = renderHook(() => useRaceConditionGuard());

      let value: string | undefined;
      await act(async () => {
        value = await result.current.execute(() => Promise.resolve("hello"));
      });

      expect(value).toBe("hello");
    });

    it("transitions to rejected when the operation throws", async () => {
      const { result } = renderHook(() => useRaceConditionGuard());

      await act(async () => {
        try {
          await result.current.execute(() => Promise.reject(new Error("fail")));
        } catch {
          // expected
        }
      });

      expect(result.current.state).toBe("rejected");
    });

    it("rethrows the original operation error", async () => {
      const { result } = renderHook(() => useRaceConditionGuard());

      let caughtError: Error | undefined;
      await act(async () => {
        try {
          await result.current.execute(() => Promise.reject(new Error("fail")));
        } catch (error) {
          caughtError = error as Error;
        }
      });

      expect(caughtError?.message).toBe("fail");
    });
  });

  describe("duplicate execution", () => {
    it("blocks a second request while the first is pending", async () => {
      const { result } = renderHook(() => useRaceConditionGuard());

      let resolveFirst!: (v: string) => void;
      let firstPromise!: Promise<string>;
      act(() => {
        firstPromise = result.current.execute(
          () => new Promise<string>((resolve) => { resolveFirst = resolve; }),
        );
      });
      const operation = vi.fn(() => Promise.resolve("second-done"));

      expect(result.current.isPending).toBe(true);
      await expect(result.current.execute(operation)).rejects.toThrow(
        "Operation already in progress",
      );
      expect(operation).not.toHaveBeenCalled();

      await act(async () => {
        resolveFirst("first-done");
        await firstPromise;
      });
      expect(result.current.state).toBe("resolved");
      expect(result.current.isPending).toBe(false);
    });
  });

  describe("reset", () => {
    it("resets state back to idle after execution", async () => {
      const { result } = renderHook(() => useRaceConditionGuard());

      await act(async () => {
        await result.current.execute(() => Promise.resolve("done"));
      });

      expect(result.current.state).toBe("resolved");

      act(() => {
        result.current.reset();
      });

      expect(result.current.state).toBe("idle");
    });

    it("reset allows executing again after previous execution", async () => {
      const { result } = renderHook(() => useRaceConditionGuard());

      await act(async () => {
        await result.current.execute(() => Promise.resolve("first"));
      });

      act(() => {
        result.current.reset();
      });

      await act(async () => {
        await result.current.execute(() => Promise.resolve("second"));
      });

      expect(result.current.state).toBe("resolved");
    });
  });
});
