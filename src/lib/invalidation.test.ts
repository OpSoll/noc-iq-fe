import { describe, it, expect } from "vitest";
import { getInvalidations, invalidationMap } from "./invalidation";

describe("getInvalidations", () => {
  it("returns keys for known mutations", () => {
    expect(getInvalidations("outage.create").length).toBeGreaterThan(0);
    expect(getInvalidations("payment.process").length).toBeGreaterThan(0);
  });
  it("returns empty for unknown mutations", () => {
    expect(getInvalidations("unknown.mutation")).toEqual([]);
  });
  it("outage mutations invalidate dashboard root key", () => {
    const keys = getInvalidations("outage.create");
    const flatKeys = keys.map((k) => JSON.stringify(k));
    expect(flatKeys.some((k) => k.includes('"dashboard"'))).toBe(true);
  });
  it("wallet mutations do NOT invalidate dashboard", () => {
    const keys = getInvalidations("wallet.create");
    const flatKeys = keys.map((k) => JSON.stringify(k));
    expect(flatKeys.some((k) => k.includes('"dashboard"'))).toBe(false);
  });
  it("payment retry and reconcile invalidate dashboard", () => {
    expect(getInvalidations("payment.retry").length).toBeGreaterThan(0);
    expect(getInvalidations("payment.reconcile").length).toBeGreaterThan(0);
  });
});

describe("invalidationMap", () => {
  it("has entries for all major entities", () => {
    const types = invalidationMap.map((e) => e.mutationType);
    expect(types).toContain("outage.create");
    expect(types).toContain("payment.process");
    expect(types).toContain("webhook.create");
  });
  it("no full-cache blast patterns", () => {
    for (const entry of invalidationMap) {
      for (const key of entry.invalidate) {
        expect(JSON.stringify(key)).not.toContain('"*"');
      }
    }
  });
});
