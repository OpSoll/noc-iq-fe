import { useState, useCallback, useRef } from "react";

import { api } from "@/lib/api";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

/** Minimal contract the server record must satisfy. */
export interface Timestamped {
  updated_at: string;
}

export type StaleGuardDecision = "proceed" | "stale" | "error";

export interface StaleCheckResult {
  decision: StaleGuardDecision;
  /** ISO-8601 timestamp the server currently holds. */
  serverUpdatedAt: string | null;
  /** ISO-8601 timestamp the form was initialised with. */
  formUpdatedAt: string;
  /** Present only when `decision === "error"`. */
  error?: string;
}

export interface StaleConflict {
  formUpdatedAt: string;
  serverUpdatedAt: string;
}

export interface UseStaleGuardOptions {
  /**
   * The API endpoint that returns the record.
   * e.g. `/outages/abc-123`
   */
  endpoint: string;

  /**
   * The `updated_at` value captured when the form was first loaded.
   * Used as the baseline version to compare against the server.
   */
  formUpdatedAt: string;
}

export interface UseStaleGuardReturn {
  /**
   * Wrap your form submit handler with this function.
   * It fetches the latest server version, compares timestamps, and either
   * invokes `onSubmit` directly or sets the conflict state so the UI can
   * render the `StaleDataConflictModal`.
   */
  guardedSubmit: (onSubmit: () => Promise<void> | void) => Promise<void>;

  /**
   * Non-null when the guard detected a conflict.
   * Pass this to `<StaleDataConflictModal>` to render the diff / overwrite UI.
   */
  conflict: StaleConflict | null;

  /** Dismiss the conflict modal without overwriting. */
  dismissConflict: () => void;

  /**
   * Force-overwrite: clears the conflict and runs the original submit.
   * Call this from the modal's "Overwrite" button.
   */
  forceSubmit: () => Promise<void>;

  /** True while the guard is fetching the server version. */
  isChecking: boolean;

  /** Non-null when the freshness check itself failed (network error, etc.). */
  checkError: string | null;
}

/* -------------------------------------------------------------------------- */
/*  Hook                                                                       */
/* -------------------------------------------------------------------------- */

export function useStaleGuard({
  endpoint,
  formUpdatedAt,
}: UseStaleGuardOptions): UseStaleGuardReturn {
  const [conflict, setConflict] = useState<StaleConflict | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  // Store the pending submit callback so `forceSubmit` can invoke it later.
  const pendingSubmitRef = useRef<(() => Promise<void> | void) | null>(null);

  /**
   * Fetch the record and compare its `updated_at` against the form baseline.
   */
  const checkFreshness = useCallback(async (): Promise<StaleCheckResult> => {
    try {
      const res = await api.get<Timestamped>(endpoint);
      const serverUpdatedAt = res.data.updated_at;

      const serverTime = new Date(serverUpdatedAt).getTime();
      const formTime = new Date(formUpdatedAt).getTime();

      if (serverTime > formTime) {
        return {
          decision: "stale",
          serverUpdatedAt,
          formUpdatedAt,
        };
      }

      return {
        decision: "proceed",
        serverUpdatedAt,
        formUpdatedAt,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to verify record freshness";
      return {
        decision: "error",
        serverUpdatedAt: null,
        formUpdatedAt,
        error: message,
      };
    }
  }, [endpoint, formUpdatedAt]);

  const guardedSubmit = useCallback(
    async (onSubmit: () => Promise<void> | void) => {
      setCheckError(null);
      setConflict(null);
      setIsChecking(true);

      try {
        const result = await checkFreshness();

        switch (result.decision) {
          case "proceed":
            await onSubmit();
            break;

          case "stale":
            // Park the callback for a potential force-submit.
            pendingSubmitRef.current = onSubmit;
            setConflict({
              formUpdatedAt: result.formUpdatedAt,
              serverUpdatedAt: result.serverUpdatedAt!,
            });
            break;

          case "error":
            setCheckError(result.error ?? "Unknown error");
            break;
        }
      } finally {
        setIsChecking(false);
      }
    },
    [checkFreshness],
  );

  const dismissConflict = useCallback(() => {
    setConflict(null);
    pendingSubmitRef.current = null;
  }, []);

  const forceSubmit = useCallback(async () => {
    const submit = pendingSubmitRef.current;
    setConflict(null);
    pendingSubmitRef.current = null;

    if (submit) {
      await submit();
    }
  }, []);

  return {
    guardedSubmit,
    conflict,
    dismissConflict,
    forceSubmit,
    isChecking,
    checkError,
  };
}
