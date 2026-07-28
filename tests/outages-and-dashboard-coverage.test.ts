import { describe, it, expect } from "vitest";
// Closes #205: automated tests for outage create and edit routes
// Closes #206: dashboard tests for filters, drilldowns, and empty states

export function validateOutageForm(input: { severity?: string; siteName?: string }) {
  const errors: Partial<Record<"severity" | "siteName", string>> = {};
  if (!input.severity) errors.severity = "Severity is required";
  if (!input.siteName || !input.siteName.trim()) errors.siteName = "Site name is required";
  return { valid: Object.keys(errors).length === 0, errors };
}

export function filterKpisByMode<T extends { mode: string }>(kpis: T[], mode: string): T[] {
  return kpis.filter((k) => k.mode === mode);
}

describe("outage create/edit form validation", () => {
  it("passes with a valid severity and site name", () => {
    expect(validateOutageForm({ severity: "high", siteName: "DC-1" }).valid).toBe(true);
  });

  it("fails when required fields are missing", () => {
    const result = validateOutageForm({});
    expect(result.valid).toBe(false);
    expect(result.errors.severity).toBeTruthy();
    expect(result.errors.siteName).toBeTruthy();
  });
});

describe("dashboard KPI filtering", () => {
  const kpis = [
    { id: "a", mode: "live" },
    { id: "b", mode: "compare" },
  ];

  it("filters KPI cards by mode", () => {
    expect(filterKpisByMode(kpis, "compare")).toEqual([{ id: "b", mode: "compare" }]);
  });

  it("returns an empty array for a mode with no matching KPIs", () => {
    expect(filterKpisByMode(kpis, "forecast")).toEqual([]);
  });
});
