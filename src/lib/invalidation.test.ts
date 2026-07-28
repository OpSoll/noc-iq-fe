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
        expect(key).not.toEqual(["*"]);
      }
    }
  });
});
