import { describe, it, expect, vi } from "vitest";
import {
  MutationTracker,
  MutationTrackerError,
  runTrackedMutation,
  getPendingMutations,
  addPendingMutation,
  clearPendingMutation,
  clearAllPendingMutations,
} from "./mutationTracker";

// ─── MutationTracker core ─────────────────────────────────────────────────────

describe("MutationTracker", () => {
  it("runs all steps in order and returns their results", async () => {
    const order: string[] = [];
    const tracker = new MutationTracker();

    tracker.addStep({
      name: "step-a",
      execute: () => { order.push("a"); return "result-a"; },
      rollback: vi.fn(),
    });
    tracker.addStep({
      name: "step-b",
      execute: () => { order.push("b"); return "result-b"; },
      rollback: vi.fn(),
    });

    const results = await tracker.run();

    expect(order).toEqual(["a", "b"]);
    expect(results).toEqual(["result-a", "result-b"]);
  });

  it("throws MutationTrackerError when a step fails", async () => {
    const tracker = new MutationTracker();
    tracker.addStep({
      name: "failing-step",
      execute: () => { throw new Error("step exploded"); },
      rollback: vi.fn(),
    });

    await expect(tracker.run()).rejects.toBeInstanceOf(MutationTrackerError);
  });

  it("includes the failed step name in the error summary", async () => {
    const tracker = new MutationTracker();
    tracker.addStep({
      name: "exploding-step",
      execute: () => { throw new Error("boom"); },
      rollback: vi.fn(),
    });

    const err = await tracker.run().catch((e) => e) as MutationTrackerError;
    expect(err.summary.failedStep).toBe("exploding-step");
    expect(err.summary.failedStepIndex).toBe(0);
  });

  it("rolls back completed steps in reverse order when a later step fails", async () => {
    const rollbackOrder: string[] = [];

    const tracker = new MutationTracker();
    tracker.addStep({
      name: "step-1",
      execute: () => "r1",
      rollback: () => { rollbackOrder.push("rollback-1"); },
    });
    tracker.addStep({
      name: "step-2",
      execute: () => "r2",
      rollback: () => { rollbackOrder.push("rollback-2"); },
    });
    tracker.addStep({
      name: "step-3-fails",
      execute: () => { throw new Error("step 3 error"); },
      rollback: vi.fn(),
    });

    await tracker.run().catch(() => {});

    // Rollbacks run in reverse: step-2 first, then step-1
    expect(rollbackOrder).toEqual(["rollback-2", "rollback-1"]);
  });

  it("records rolled-back step names in the failure summary", async () => {
    const tracker = new MutationTracker();
    tracker.addStep({
      name: "step-ok",
      execute: () => "done",
      rollback: () => {},
    });
    tracker.addStep({
      name: "step-fail",
      execute: () => { throw new Error("fail"); },
      rollback: vi.fn(),
    });

    const err = await tracker.run().catch((e) => e) as MutationTrackerError;
    expect(err.summary.rolledBack).toContain("step-ok");
  });

  it("captures rollback errors without suppressing the original failure", async () => {
    const tracker = new MutationTracker();
    tracker.addStep({
      name: "step-ok",
      execute: () => "done",
      rollback: () => { throw new Error("rollback also failed"); },
    });
    tracker.addStep({
      name: "step-fail",
      execute: () => { throw new Error("primary failure"); },
      rollback: vi.fn(),
    });

    const err = await tracker.run().catch((e) => e) as MutationTrackerError;
    expect(err).toBeInstanceOf(MutationTrackerError);
    expect(err.summary.error).toBeInstanceOf(Error);
    expect((err.summary.error as Error).message).toBe("primary failure");
    expect(err.summary.rollbackErrors).toHaveLength(1);
    expect(err.summary.rollbackErrors[0].stepName).toBe("step-ok");
  });

  it("passes the step result to the rollback function", async () => {
    const rollbackSpy = vi.fn();
    const tracker = new MutationTracker();
    tracker.addStep({
      name: "step-produces-value",
      execute: () => ({ id: "abc123" }),
      rollback: rollbackSpy,
    });
    tracker.addStep({
      name: "step-fails",
      execute: () => { throw new Error("boom"); },
      rollback: vi.fn(),
    });

    await tracker.run().catch(() => {});

    expect(rollbackSpy).toHaveBeenCalledWith({ id: "abc123" });
  });

  it("does not call rollback on steps that never executed", async () => {
    const neverRan = vi.fn();
    const tracker = new MutationTracker();
    tracker.addStep({
      name: "step-fails-first",
      execute: () => { throw new Error("immediate fail"); },
      rollback: vi.fn(),
    });
    tracker.addStep({
      name: "step-never-ran",
      execute: vi.fn(),
      rollback: neverRan,
    });

    await tracker.run().catch(() => {});

    expect(neverRan).not.toHaveBeenCalled();
  });

  it("supports async steps and rollbacks", async () => {
    const rollbackSpy = vi.fn().mockResolvedValue(undefined);
    const tracker = new MutationTracker();
    tracker.addStep({
      name: "async-step",
      execute: () => Promise.resolve("async-result"),
      rollback: rollbackSpy,
    });
    tracker.addStep({
      name: "async-fail",
      execute: () => Promise.reject(new Error("async boom")),
      rollback: vi.fn(),
    });

    await tracker.run().catch(() => {});

    expect(rollbackSpy).toHaveBeenCalledWith("async-result");
  });

  it("stepCount returns the number of registered steps", () => {
    const tracker = new MutationTracker();
    expect(tracker.stepCount).toBe(0);
    tracker.addStep({ name: "s1", execute: () => {}, rollback: () => {} });
    expect(tracker.stepCount).toBe(1);
  });
});

// ─── runTrackedMutation convenience helper ────────────────────────────────────

describe("runTrackedMutation", () => {
  it("runs all steps and returns results", async () => {
    const results = await runTrackedMutation([
      { name: "a", execute: () => 1, rollback: vi.fn() },
      { name: "b", execute: () => 2, rollback: vi.fn() },
    ]);
    expect(results).toEqual([1, 2]);
  });

  it("throws MutationTrackerError when a step fails", async () => {
    await expect(
      runTrackedMutation([
        { name: "fail", execute: () => { throw new Error("x"); }, rollback: vi.fn() },
      ]),
    ).rejects.toBeInstanceOf(MutationTrackerError);
  });
});

// ─── PendingMutation session store (original API unchanged) ───────────────────

describe("PendingMutation session store", () => {
  beforeEach(() => sessionStorage.clear());

  it("returns empty array when no mutations stored", () => {
    expect(getPendingMutations()).toEqual([]);
  });

  it("adds and retrieves a pending mutation", () => {
    const m = { id: "1", description: "test", url: "/api", method: "POST", data: null, timestamp: Date.now() };
    addPendingMutation(m);
    expect(getPendingMutations()).toContainEqual(m);
  });

  it("clears a single mutation by id", () => {
    addPendingMutation({ id: "x", description: "", url: "/", method: "GET", data: null, timestamp: 0 });
    clearPendingMutation("x");
    expect(getPendingMutations().find((m) => m.id === "x")).toBeUndefined();
  });

  it("clears all mutations", () => {
    addPendingMutation({ id: "1", description: "", url: "/", method: "GET", data: null, timestamp: 0 });
    addPendingMutation({ id: "2", description: "", url: "/", method: "GET", data: null, timestamp: 0 });
    clearAllPendingMutations();
    expect(getPendingMutations()).toEqual([]);
  });
});
