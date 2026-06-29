import { useState, useCallback, useRef } from "react";

export type RaceGuardState = "idle" | "pending" | "resolved" | "rejected" | "superseded";

export type RaceGuardResult<T> = {
  execute: (...args: unknown[]) => Promise<T>;
  state: RaceGuardState;
  reset: () => void;
};

export function useRaceConditionGuard<T = unknown>(): RaceGuardResult<T> {
  const [state, setState] = useState<RaceGuardState>("idle");
  const pendingRef = useRef<symbol | null>(null);

  const execute = useCallback(async (...args: unknown[]): Promise<T> => {
    const token = Symbol();
    pendingRef.current = token;
    setState("pending");

    try {
      const fn = args[0] as () => Promise<T>;
      const result = await fn();
      if (pendingRef.current !== token) {
        setState("superseded");
        return result;
      }
      setState("resolved");
      return result;
    } catch {
      if (pendingRef.current === token) {
        setState("rejected");
      }
      throw new Error("Operation superseded by a newer request");
    }
  }, []);

  const reset = useCallback(() => {
    pendingRef.current = null;
    setState("idle");
  }, []);

  return { execute, state, reset };
}
