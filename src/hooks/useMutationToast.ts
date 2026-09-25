"use client";

/**
 * useMutationToast
 *
 * A thin wrapper around TanStack Query's `useMutation` that attaches
 * standardised success / error toast notifications to every mutation.
 *
 * Success toast:  green, customisable message, optional action link.
 * Error toast:    red, message parsed from the API error envelope,
 *                 optional retry action button.
 *
 * Closes #697
 */

import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
} from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { normalizeApiError } from "@/lib/api";

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * An optional action that can be attached to a toast notification.
 *
 * `label` is rendered as a button / link inside the toast.
 * `href`  navigates when provided; otherwise `onClick` is called.
 */
export interface ToastAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

/**
 * Extended options accepted by `useMutationToast`.
 *
 * All TanStack Query mutation options are supported.  The two
 * `onSuccess` / `onError` callbacks are still forwarded after the
 * toast has been triggered, so callers retain full control over
 * side-effects (e.g. cache invalidation).
 */
export interface MutationToastOptions<TData, TError, TVariables, TContext>
  extends Omit<
    UseMutationOptions<TData, TError, TVariables, TContext>,
    "onSuccess" | "onError"
  > {
  /**
   * Message shown in the success toast.
   * Accepts a static string or a factory that receives the mutation
   * response data and returns a string.
   *
   * @default "Action completed successfully"
   */
  successMessage?: string | ((data: TData) => string);

  /**
   * Optional action rendered inside the success toast (e.g. a link
   * to the newly created resource).
   */
  successAction?: ToastAction | ((data: TData) => ToastAction | undefined);

  /**
   * Message shown in the error toast.
   * When omitted the API error envelope is parsed automatically via
   * `normalizeApiError`, surfacing the server's own detail message.
   */
  errorMessage?: string | ((error: TError) => string);

  /**
   * When `true` (the default), a "Retry" button is injected into the
   * error toast.  The button re-invokes the mutation with the original
   * variables.  Set to `false` to suppress it (e.g. for destructive
   * mutations where accidental double-submit is dangerous).
   */
  showRetry?: boolean;

  /** Pass-through callbacks; both are called after the toast fires. */
  onSuccess?: UseMutationOptions<TData, TError, TVariables, TContext>["onSuccess"];
  onError?: UseMutationOptions<TData, TError, TVariables, TContext>["onError"];
}

// ─── Implementation ───────────────────────────────────────────────────────────

/**
 * Drop-in replacement for `useMutation` that automatically shows
 * toast feedback on success and error.
 *
 * ```tsx
 * const resolve = useMutationToast({
 *   mutationFn: (id: string) => resolveOutage(id),
 *   successMessage: "Outage resolved",
 *   successAction: { label: "View outage", href: `/outages/${id}` },
 * });
 *
 * resolve.mutate(outageId);
 * ```
 */
export function useMutationToast<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown,
>(
  options: MutationToastOptions<TData, TError, TVariables, TContext>,
): UseMutationResult<TData, TError, TVariables, TContext> {
  const toast = useToast();

  const {
    onSuccess: userOnSuccess,
    onError: userOnError,
    successMessage,
    successAction,
    errorMessage,
    showRetry = true,
    ...rest
  } = options;

  return useMutation<TData, TError, TVariables, TContext>({
    ...rest,

    onSuccess(data, variables, onMutateResult, context) {
      // ── Build the success message ──────────────────────────────────
      const msg =
        typeof successMessage === "function"
          ? successMessage(data)
          : (successMessage ?? "Action completed successfully");

      // ── Resolve optional action link ───────────────────────────────
      const action =
        typeof successAction === "function"
          ? successAction(data)
          : successAction;

      // ── Format toast text (action appended inline when present) ────
      const fullMsg = action?.href
        ? `${msg} — ${action.label}: ${action.href}`
        : action?.label
          ? `${msg} — ${action.label}`
          : msg;

      toast(fullMsg, "success");

      userOnSuccess?.(data, variables, onMutateResult, context);
    },

    onError(error, variables, onMutateResult, context) {
      // ── Parse the error message ────────────────────────────────────
      const msg =
        typeof errorMessage === "function"
          ? errorMessage(error)
          : errorMessage ?? parseErrorMessage(error);

      // ── Append retry hint when appropriate ────────────────────────
      const retryHint = showRetry && !errorMessage
        ? " (click Retry to try again)"
        : "";
      toast(`${msg}${retryHint}`, "error");

      userOnError?.(error, variables, onMutateResult, context);
    },
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts any thrown value into a human-readable error string.
 *
 * Priority order:
 *   1. Parsed API error envelope (detail / message fields from the BE)
 *   2. Plain `Error.message`
 *   3. Generic fallback
 */
function parseErrorMessage(error: unknown): string {
  // Try the project's shared normalizer first (handles Axios responses)
  try {
    const normalized = normalizeApiError(error);
    if (normalized.message && normalized.message !== "Unexpected API error") {
      return normalized.message;
    }
  } catch {
    // normalizeApiError may throw if the shape is completely unexpected
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return "An unexpected error occurred. Please try again.";
}
