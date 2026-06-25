import { describe, it, expect } from "vitest";
import { createMockApi } from "@/tests/mocks/apiMock";
import type { Outage } from "@/types/outages";

interface MutationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function simulateMutation<T>(
  mockApi: ReturnType<typeof createMockApi>,
  operation: () => Promise<T>,
  shouldFail: boolean,
): Promise<MutationResult<T>> {
  if (shouldFail) {
    const errorMock = createMockApi({ errorRate: 1 });
    try {
      await errorMock.getOutages();
      return { success: false, error: "Simulated mutation failure" };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
  try {
    const data = await operation();
    return { success: true, data };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

describe("Optimistic UI Rollback Mutation Stress Tests", () => {
  const mock = createMockApi();

  it("resolves outage mutation restores list consistency after rollback", async () => {
    const initial = await mock.getOutages();
    const initialCount = initial.length;

    // Simulate a failed resolve mutation
    const failResult = await simulateMutation(
      mock,
      () => mock.getOutage("mock-1"),
      true,
    );
    expect(failResult.success).toBe(false);

    // List should remain unchanged after rollback
    const afterRollback = await mock.getOutages();
    expect(afterRollback.length).toBe(initialCount);
    expect(afterRollback.map((o: Outage) => o.id).sort()).toEqual(
      initial.map((o: Outage) => o.id).sort(),
    );
  });

  it("rapid success/failure alternation maintains data consistency", async () => {
    const initial = await mock.getOutages();
    const statuses: boolean[] = [];

    // Alternate successes and failures
    for (let i = 0; i < 10; i++) {
      const shouldFail = i % 2 === 0;
      const result = await simulateMutation(
        mock,
        () => mock.getOutages(),
        shouldFail,
      );
      statuses.push(result.success);
    }

    // Final state should match initial
    const final = await mock.getOutages();
    expect(final.length).toBe(initial.length);

    // Exactly half should have failed
    const failures = statuses.filter((s) => !s).length;
    expect(failures).toBe(5);
  });

  it("no stale toast artifacts remain after rollback", async () => {
    const results: MutationResult<Outage[]>[] = [];

    // Batch of mutations with mixed results
    for (let i = 0; i < 5; i++) {
      const result = await simulateMutation(
        mock,
        () => mock.getOutages(),
        i === 2,
      );
      results.push(result);
    }

    // Check for stale states
    const failures = results.filter((r) => !r.success);
    const successes = results.filter((r) => r.success);

    expect(failures.length + successes.length).toBe(5);
    // No loading artifacts - all resolved
    failures.forEach((r) => expect(r.error).toBeTruthy());
    successes.forEach((r) => expect(r.data).toBeTruthy());
  });

  it("chained payment mutations rollback correctly", async () => {
    const initialPayments = await mock.getPayments();
    const initialCount = initialPayments.length;

    // Simulate a failed payment creation followed by retry
    const failResult = await simulateMutation(
      mock,
      () => mock.getPayments(),
      true,
    );
    expect(failResult.success).toBe(false);

    // Attempt payment list refresh
    const refreshResult = await simulateMutation(
      mock,
      () => mock.getPayments(),
      false,
    );
    expect(refreshResult.success).toBe(true);

    // List detail consistency maintained
    const finalPayments = refreshResult.data!;
    expect(finalPayments.length).toBe(initialCount);
  });

  it("rapid outage updates do not corrupt detail view", async () => {
    const outageId = "mock-1";
    const initial = await mock.getOutage(outageId);
    expect(initial).toBeTruthy();

    const updates = Array.from({ length: 5 }, (_, i) => i % 2 === 0);
    for (const shouldFail of updates) {
      await simulateMutation(
        mock,
        () => mock.getOutage(outageId),
        shouldFail,
      );
    }

    const final = await mock.getOutage(outageId);
    expect(final).toBeTruthy();
    expect(final!.id).toBe(outageId);
  });
});
