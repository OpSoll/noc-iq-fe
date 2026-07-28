import { describe, it, expect } from "vitest";
import { checkConsistency } from "./consistencyCheck";

describe("checkConsistency", () => {
  it("returns consistent when values match", () => {
    const result = checkConsistency({ outages: 10 }, { outages: 10 });
    expect(result.consistent).toBe(true);
    expect(result.mismatches).toHaveLength(0);
  });

  it("detects mismatches above tolerance", () => {
    const result = checkConsistency({ outages: 10 }, { outages: 12 });
    expect(result.consistent).toBe(false);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0].delta).toBe(2);
  });

  it("respects custom tolerances", () => {
    const result = checkConsistency({ outages: 10 }, { outages: 10.5 }, { outages: 1 });
    expect(result.consistent).toBe(true);
  });
});
