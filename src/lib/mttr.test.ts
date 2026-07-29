import { describe, it, expect } from "vitest";
import {
  toMttrMinutes,
  splitMttrMinutes,
  validateMttrMinutes,
  formatMttrSummary,
  MINUTES_PER_HOUR,
} from "./mttr";

describe("toMttrMinutes", () => {
  it("converts hours and minutes into a total", () => {
    expect(toMttrMinutes(1, 30)).toBe(90);
    expect(toMttrMinutes(2, 0)).toBe(120);
    expect(toMttrMinutes(0, 45)).toBe(45);
  });

  it("accepts string inputs from form fields", () => {
    expect(toMttrMinutes("1", "30")).toBe(90);
    expect(toMttrMinutes(" 2 ", " 15 ")).toBe(135);
  });

  it("treats blank and nullish fields as zero", () => {
    expect(toMttrMinutes("", "30")).toBe(30);
    expect(toMttrMinutes("2", "")).toBe(120);
    expect(toMttrMinutes(null, undefined)).toBe(0);
    expect(toMttrMinutes("", "")).toBe(0);
  });

  it("returns NaN for non-numeric input", () => {
    expect(toMttrMinutes("abc", "30")).toBeNaN();
    expect(toMttrMinutes("1", "xyz")).toBeNaN();
    expect(toMttrMinutes(Infinity, 0)).toBeNaN();
  });

  it("propagates negative values so validation can reject them", () => {
    expect(toMttrMinutes(-1, 0)).toBe(-60);
    expect(toMttrMinutes(0, -30)).toBe(-30);
  });

  it("handles fractional hours", () => {
    expect(toMttrMinutes(0.5, 0)).toBe(30);
    expect(toMttrMinutes(1.5, 15)).toBe(105);
  });
});

describe("splitMttrMinutes", () => {
  it("splits a total into whole hours and remaining minutes", () => {
    expect(splitMttrMinutes(90)).toEqual({ hours: 1, minutes: 30 });
    expect(splitMttrMinutes(120)).toEqual({ hours: 2, minutes: 0 });
    expect(splitMttrMinutes(45)).toEqual({ hours: 0, minutes: 45 });
    expect(splitMttrMinutes(1445)).toEqual({ hours: 24, minutes: 5 });
  });

  it("returns zeroes for non-positive or invalid totals", () => {
    expect(splitMttrMinutes(0)).toEqual({ hours: 0, minutes: 0 });
    expect(splitMttrMinutes(-30)).toEqual({ hours: 0, minutes: 0 });
    expect(splitMttrMinutes(NaN)).toEqual({ hours: 0, minutes: 0 });
    expect(splitMttrMinutes(null)).toEqual({ hours: 0, minutes: 0 });
    expect(splitMttrMinutes(undefined)).toEqual({ hours: 0, minutes: 0 });
  });

  it("round-trips with toMttrMinutes", () => {
    for (const total of [1, 59, 60, 61, 90, 599, 1440]) {
      const { hours, minutes } = splitMttrMinutes(total);
      expect(toMttrMinutes(hours, minutes)).toBe(total);
    }
  });
});

describe("validateMttrMinutes", () => {
  it("accepts positive totals", () => {
    expect(validateMttrMinutes(1)).toEqual({ valid: true, error: null });
    expect(validateMttrMinutes(90)).toEqual({ valid: true, error: null });
  });

  it("rejects zero", () => {
    const result = validateMttrMinutes(0);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("MTTR must be greater than 0 minutes.");
  });

  it("rejects negative totals", () => {
    const result = validateMttrMinutes(-15);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("MTTR must be greater than 0 minutes.");
  });

  it("rejects non-numeric totals", () => {
    const result = validateMttrMinutes(NaN);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Enter MTTR as a number.");
  });
});

describe("formatMttrSummary", () => {
  it("formats sub-hour totals", () => {
    expect(formatMttrSummary(1)).toBe("1 minute");
    expect(formatMttrSummary(45)).toBe("45 minutes");
  });

  it("formats whole-hour and mixed totals", () => {
    expect(formatMttrSummary(120)).toBe("120 minutes (2h)");
    expect(formatMttrSummary(90)).toBe("90 minutes (1h 30m)");
  });

  it("returns a placeholder for invalid totals", () => {
    expect(formatMttrSummary(0)).toBe("—");
    expect(formatMttrSummary(-5)).toBe("—");
    expect(formatMttrSummary(NaN)).toBe("—");
  });
});

describe("MINUTES_PER_HOUR", () => {
  it("is 60", () => {
    expect(MINUTES_PER_HOUR).toBe(60);
  });
});
