"use client";

/**
 * mutationTracker.ts
 *
 * Two responsibilities live here:
 *
 * 1. PendingMutation session store  (original — preserved unchanged)
 *    Persists in-flight mutation metadata to sessionStorage so the
 *    SessionExpiryModal can offer retry after token refresh.
 *
 * 2. MutationTracker rollback manager  (new — closes #720)
 *    Coordinates multi-step UI mutation operations and executes rollback
 *    functions in reverse order if any step fails, preventing partial UI
 *    state from persisting.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Section 1 — PendingMutation session store (original, unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export interface PendingMutation {
  id: string;
  description: string;
  url: string;
  method: string;
  data: unknown;
  timestamp: number;
}

const MUTATIONS_KEY = "noc_pending_mutations";

export function getPendingMutations(): PendingMutation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(MUTATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addPendingMutation(mutation: PendingMutation): void {
  if (typeof window === "undefined") return;
  const existing = getPendingMutations();
  existing.push(mutation);
  try {
    sessionStorage.setItem(MUTATIONS_KEY, JSON.stringify(existing.slice(-10)));
  } catch {
    // storage full
  }
}

export function clearPendingMutation(id: string): void {
  const existing = getPendingMutations().filter((m) => m.id !== id);
  try {
    sessionStorage.setItem(MUTATIONS_KEY, JSON.stringify(existing));
  } catch {
    // storage unavailable
  }
}

export function clearAllPendingMutations(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(MUTATIONS_KEY);
  } catch {
    // storage unavailable
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 2 — MutationTracker rollback manager (new — closes #720)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single step inside a tracked multi-step mutation.
 *
 * @typeParam T  The value produced by this step's execute function.
 */
export interface MutationStep<T = unknown> {
  /** Human-readable name used in error summaries and toasts. */
  name: string;
  /**
   * Performs the mutation. May be async.
   * The returned value is stored and can be consumed by later steps if needed.
   */
  execute: () => T | Promise<T>;
  /**
   * Called when a *later* step fails. Receives the value that was returned by
   * `execute` so it has enough context to undo the effect (e.g. delete the
   * record that was just created).
   * Rollbacks run in reverse order (last-committed first).
   * May be async. Rollback errors are captured but do not suppress the
   * original failure.
   */
  rollback: (result: T) => void | Promise<void>;
}

/** Summary emitted when a tracked operation fails after rollback. */
export interface MutationFailureSummary {
  /** The name of the step that caused the failure. */
  failedStep: string;
  /** Zero-based index of the failed step. */
  failedStepIndex: number;
  /** The original error thrown by the failed step. */
  error: unknown;
  /** Names of the rollback operations that were executed (in the order they ran). */
  rolledBack: string[];
  /** Names of rollback operations that themselves threw errors. */
  rollbackErrors: Array<{ stepName: string; error: unknown }>;
}

/**
 * MutationTrackerError
 *
 * Thrown by `MutationTracker.run()` when any step fails.
 * Carries the full `MutationFailureSummary` so callers can surface a precise
 * error toast without re-fetching state.
 */
export class MutationTrackerError extends Error {
  readonly summary: MutationFailureSummary;

  constructor(summary: MutationFailureSummary) {
    const rolledBack =
      summary.rolledBack.length > 0
        ? ` Rolled back: ${summary.rolledBack.join(", ")}.`
        : "";
    super(
      `Mutation failed at step "${summary.failedStep}": ${
        summary.error instanceof Error
          ? summary.error.message
          : String(summary.error)
      }.${rolledBack}`,
    );
    this.name = "MutationTrackerError";
    this.summary = summary;
  }
}

/**
 * MutationTracker
 *
 * Coordinates a sequence of named mutation steps and guarantees that already-
 * executed steps are rolled back in reverse order if any later step throws.
 *
 * @example
 * ```ts
 * const tracker = new MutationTracker();
 *
 * tracker.addStep({
 *   name: "bulk-update-status",
 *   execute: () => api.patch("/outages/bulk", { status: "resolved" }),
 *   rollback: () => api.patch("/outages/bulk", { status: "open" }),
 * });
 *
 * tracker.addStep({
 *   name: "dispatch-webhook",
 *   execute: () => api.post("/webhooks/dispatch", { event: "bulk_resolved" }),
 *   rollback: () => { /* webhook dispatch is best-effort, no-op rollback *\/ },
 * });
 *
 * try {
 *   await tracker.run();
 * } catch (err) {
 *   if (err instanceof MutationTrackerError) {
 *     showToast(err.message, "error");
 *   }
 * }
 * ```
 */
export class MutationTracker<TResults extends unknown[] = unknown[]> {
  private readonly steps: MutationStep[] = [];

  /**
   * Appends a step to the execution sequence.
   * Steps run in the order they are added.
   */
  addStep<T>(step: MutationStep<T>): this {
    this.steps.push(step as MutationStep<unknown>);
    return this;
  }

  /**
   * Executes all steps in order. If any step throws, already-completed steps
   * are rolled back in reverse order before re-throwing a `MutationTrackerError`.
   *
   * @returns  A tuple of each step's return value in execution order.
   * @throws   `MutationTrackerError` when any step fails.
   */
  async run(): Promise<TResults> {
    const results: unknown[] = [];

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      try {
        const result = await step.execute();
        results.push(result);
      } catch (stepError) {
        // Collect the steps that already completed successfully (indices 0…i-1)
        // and run their rollbacks in reverse order.
        const completedSteps = this.steps.slice(0, i);
        const rolledBack: string[] = [];
        const rollbackErrors: Array<{ stepName: string; error: unknown }> = [];

        for (let r = completedSteps.length - 1; r >= 0; r--) {
          const completedStep = completedSteps[r];
          const completedResult = results[r];
          try {
            await completedStep.rollback(completedResult);
            rolledBack.push(completedStep.name);
          } catch (rollbackError) {
            rollbackErrors.push({
              stepName: completedStep.name,
              error: rollbackError,
            });
          }
        }

        throw new MutationTrackerError({
          failedStep: step.name,
          failedStepIndex: i,
          error: stepError,
          rolledBack,
          rollbackErrors,
        });
      }
    }

    return results as TResults;
  }

  /**
   * Returns the number of steps currently registered.
   * Useful for testing and guard assertions.
   */
  get stepCount(): number {
    return this.steps.length;
  }
}

/**
 * Convenience factory that creates a `MutationTracker`, adds all provided
 * steps, and immediately runs them.
 *
 * @example
 * ```ts
 * await runTrackedMutation([
 *   { name: "step-1", execute: doA, rollback: undoA },
 *   { name: "step-2", execute: doB, rollback: undoB },
 * ]);
 * ```
 */
export async function runTrackedMutation<T extends unknown[]>(
  steps: MutationStep[],
): Promise<T> {
  const tracker = new MutationTracker();
  for (const step of steps) {
    tracker.addStep(step);
  }
  return tracker.run() as Promise<T>;
}
