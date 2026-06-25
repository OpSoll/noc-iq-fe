import { describe, it, expect } from "vitest";
import { createMockApi } from "../mocks/apiMock";
import type { SLADispute } from "@/types/sla";

describe("SLA Dispute Lifecycle Workflows", () => {
  const mock = createMockApi();

  it("fetches disputes with various statuses", async () => {
    const disputes = await mock.getDisputes();
    expect(disputes.length).toBeGreaterThanOrEqual(4);

    const statuses = disputes.map((d: SLADispute) => d.status);
    expect(statuses).toContain("open");
    expect(statuses).toContain("under_review");
    expect(statuses).toContain("resolved");
    expect(statuses).toContain("rejected");
  });

  it("tracks dispute state transitions", async () => {
    const disputes = await mock.getDisputes();
    const openDispute = disputes.find((d: SLADispute) => d.status === "open");
    expect(openDispute).toBeTruthy();
    expect(openDispute!.reason).toBeTruthy();
    expect(openDispute!.outage_id).toBeTruthy();
  });

  it("resolved dispute has resolution metadata", async () => {
    const disputes = await mock.getDisputes();
    const resolved = disputes.find((d: SLADispute) => d.status === "resolved");
    expect(resolved).toBeTruthy();
    expect(resolved!.resolved_at).toBeTruthy();
    expect(resolved!.resolution_note).toBeTruthy();
  });

  it("rejected dispute has rejection metadata", async () => {
    const disputes = await mock.getDisputes();
    const rejected = disputes.find((d: SLADispute) => d.status === "rejected");
    expect(rejected).toBeTruthy();
    expect(rejected!.resolved_at).toBeTruthy();
    expect(rejected!.resolution_note).toBeTruthy();
  });

  it("unauthorized dispute access returns empty state", async () => {
    const empty = await mock.getDisputes("empty");
    expect(empty).toEqual([]);
  });

  it("dispute has valid outage reference", async () => {
    const disputes = await mock.getDisputes();
    const outageIds = [...new Set(disputes.map((d: SLADispute) => d.outage_id))];
    const outages = await mock.getOutages();
    const validIds = new Set(outages.map((o) => o.id));
    outageIds.forEach((id: string) => {
      expect(validIds.has(id)).toBe(true);
    });
  });

  it("handles latency gracefully", async () => {
    const slowMock = createMockApi({ latency: 100 });
    const start = Date.now();
    await slowMock.getDisputes();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(90);
  });

  it("handles errors gracefully", async () => {
    const errorMock = createMockApi({ errorRate: 1 });
    await expect(errorMock.getDisputes()).rejects.toThrow("Simulated API error");
  });
});
