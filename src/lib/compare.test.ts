import { describe, it, expect } from "vitest";
import { validateIntervalCompatibility, computeDeltas, imputeMissingIntervals } from "./compare";

describe("validateIntervalCompatibility", () => {
  it("matches same granularity", () => {
    expect(validateIntervalCompatibility({ start: "a", end: "b", granularity: "day" }, { start: "c", end: "d", granularity: "day" }).compatible).toBe(true);
  });
  it("rejects different granularity", () => {
    expect(validateIntervalCompatibility({ start: "a", end: "b", granularity: "hour" }, { start: "c", end: "d", granularity: "day" }).compatible).toBe(false);
  });
});

describe("computeDeltas", () => {
  it("computes deltas correctly", () => {
    const result = computeDeltas({ a: 10 }, { a: 15 });
    expect(result[0].delta).toBe(5);
    expect(result[0].deltaPercent).toBe(50);
  });
});

describe("imputeMissingIntervals", () => {
  it("adds missing intervals", () => {
    const result = imputeMissingIntervals([{ period: "2024-01" }], ["2024-01", "2024-02"]);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.period === "2024-02")?.imputed).toBe(true);
  });
});
