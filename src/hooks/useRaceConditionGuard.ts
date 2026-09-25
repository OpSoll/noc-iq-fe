import { useState, useCallback, useRef } from "react";

export type RaceGuardState = "idle" | "pending" | "resolved" | "rejected" | "superseded";

export type RaceGuardResult<T> = {
  execute: (operation: () => Promise<T>) => Promise<T>;
  state: RaceGuardState;
  isPending: boolean;
  reset: () => void;
};

export function useRaceConditionGuard<T = unknown>(): RaceGuardResult<T> {
  const [state, setState] = useState<RaceGuardState>("idle");
  const pendingRef = useRef(false);

  const execute = useCallback(async (operation: () => Promise<T>): Promise<T> => {
    if (pendingRef.current) {
      return Promise.reject(new Error("Operation already in progress"));
    }

    pendingRef.current = true;
    setState("pending");

    try {
      const result = await operation();
      setState("resolved");
      return result;
    } catch (error) {
      setState("rejected");
      throw error;
    } finally {
      pendingRef.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    pendingRef.current = false;
    setState("idle");
  }, []);

  return { execute, state, isPending: state === "pending", reset };
}
