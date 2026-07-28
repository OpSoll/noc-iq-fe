import { describe, it, expect } from "vitest";
import { validateChartConfig } from "./schemaGate";

describe("validateChartConfig", () => {
  it("validates correct config", () => {
    const result = validateChartConfig({ dimensions: ["date"], measures: ["count"], type: "bar" });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects missing dimensions", () => {
    const result = validateChartConfig({ measures: ["count"], type: "bar" });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("dimension");
  });

  it("rejects missing measures", () => {
    const result = validateChartConfig({ dimensions: ["date"], type: "bar" });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("measure");
  });

  it("rejects missing type", () => {
    const result = validateChartConfig({ dimensions: ["date"], measures: ["count"] });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("type");
  });
});
