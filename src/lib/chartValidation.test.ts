import { describe, it, expect } from "vitest";
import { validateChartData } from "./chartValidation";

describe("validateChartData", () => {
  const schema = { requiredFields: ["period", "value"], numericFields: ["value"] };

  it("returns valid for correct data", () => {
    const result = validateChartData([{ period: "2024-01", value: 100 }], schema);
    expect(result.valid).toBe(true);
    expect(result.sanitized).toHaveLength(1);
  });

  it("rejects empty data", () => {
    const result = validateChartData([], schema);
    expect(result.valid).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = validateChartData([{ period: "2024-01" }], schema);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("value");
  });

  it("rejects wrong types", () => {
    const result = validateChartData([{ period: "2024-01", value: "bad" }], schema);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("not a number");
  });
});
