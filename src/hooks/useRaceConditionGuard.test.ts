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

    it("throws an error when operation fails", async () => {
      const { result } = renderHook(() => useRaceConditionGuard());

      let caughtError: Error | undefined;
      await act(async () => {
        try {
          await result.current.execute(() => Promise.reject(new Error("fail")));
        } catch (error) {
          caughtError = error as Error;
        }
      });

      expect(caughtError?.message).toBe("Operation superseded by a newer request");
    });
  });

  describe("race condition cancellation", () => {
    it("marks first request as superseded when a second request fires", async () => {
      const { result } = renderHook(() => useRaceConditionGuard());

      // First request that never resolves
      let resolveFirst!: (v: string) => void;
      let firstPromise!: Promise<string>;
      act(() => {
        firstPromise = result.current.execute(
          () => new Promise<string>((resolve) => { resolveFirst = resolve; }),
        );
      });

      expect(result.current.state).toBe("pending");

      // Second request fires before first resolves
      let resolveSecond!: (v: string) => void;
      let secondPromise!: Promise<string>;
      act(() => {
        secondPromise = result.current.execute(
          () => new Promise<string>((resolve) => { resolveSecond = resolve; }),
        );
      });

      // Resolve the second one first
      await act(async () => {
        resolveSecond("second-done");
      });
      await secondPromise;

      // State should reflect the latest request
      expect(result.current.state).toBe("resolved");

      // Now resolve the stale first request
      await act(async () => {
        resolveFirst("first-done");
      });
      await firstPromise;

      // State should be superseded since the first was stale
      expect(result.current.state).toBe("superseded");
    });

    it("handles three rapid requests correctly", async () => {
      const { result } = renderHook(() => useRaceConditionGuard());

      const resolvers: Array<(v: string) => void> = [];

      const promise1 = result.current.execute(
        () => new Promise<string>((resolve) => { resolvers.push(resolve); }),
      );
      const promise2 = result.current.execute(
        () => new Promise<string>((resolve) => { resolvers.push(resolve); }),
      );
      const promise3 = result.current.execute(
        () => new Promise<string>((resolve) => { resolvers.push(resolve); }),
      );

      // Resolve them in order
      await act(async () => {
        resolvers[0]?.("first");
      });
      await promise1;
      expect(result.current.state).toBe("superseded");

      await act(async () => {
        resolvers[1]?.("second");
      });
      await promise2;
      expect(result.current.state).toBe("superseded");

      await act(async () => {
        resolvers[2]?.("third");
      });
      await promise3;
      expect(result.current.state).toBe("resolved");
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
