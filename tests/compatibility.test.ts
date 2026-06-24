import { describe, it, expect } from "vitest";
import {
  checkCompatibility,
  COMPATIBILITY_MATRIX,
} from "@/lib/compatibility";

describe("COMPATIBILITY_MATRIX", () => {
  it("has entries for every declared prefix", () => {
    expect(Object.keys(COMPATIBILITY_MATRIX).length).toBeGreaterThan(0);
  });
});

describe("checkCompatibility", () => {
  it("returns compatible=true for a known-good pair", () => {
    const result = checkCompatibility("0.1.0", "v1");
    expect(result.compatible).toBe(true);
    expect(result.details).toContain("compatible");
  });

  it("includes version strings in the success detail", () => {
    const result = checkCompatibility("0.1.0", "v1.1");
    expect(result.details).toContain("0.1.0");
    expect(result.details).toContain("v1.1");
  });

  it("returns compatible=false when backend version is not supported", () => {
    const result = checkCompatibility("0.1.0", "v2");
    expect(result.compatible).toBe(false);
    expect(result.details).toContain("v2");
    expect(result.details).toContain("0.1.0");
  });

  it("includes the list of supported versions in the failure detail", () => {
    const result = checkCompatibility("0.1.0", "v99");
    expect(result.compatible).toBe(false);
    expect(result.details).toMatch(/v1/);
  });

  it("returns compatible=false for an unknown frontend prefix", () => {
    const result = checkCompatibility("9.9.9", "v1");
    expect(result.compatible).toBe(false);
    expect(result.details).toContain("9.9");
  });

  it("explains the unknown prefix in the failure detail", () => {
    const result = checkCompatibility("9.9.9", "v1");
    expect(result.details).toContain("compatibility matrix");
  });

  it("handles patch version variations correctly", () => {
    // 0.1.5 and 0.1.0 share the same matrix entry
    expect(checkCompatibility("0.1.5", "v1").compatible).toBe(true);
    expect(checkCompatibility("0.1.5", "v99").compatible).toBe(false);
  });

  it("supports all version pairs in the matrix", () => {
    for (const [prefix, versions] of Object.entries(COMPATIBILITY_MATRIX)) {
      for (const beVersion of versions) {
        const result = checkCompatibility(`${prefix}.0`, beVersion);
        expect(result.compatible).toBe(true);
      }
    }
  });
});
