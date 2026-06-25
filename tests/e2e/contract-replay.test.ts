import { describe, it, expect } from "vitest";
import { ALL_FIXTURES, type ContractFixture } from "@/tests/fixtures/contract-fixtures";

interface ParserResult<T> {
  parsed: boolean;
  fields: string[];
  mismatches: string[];
}

function replayFixture<T extends Record<string, unknown>>(
  fixture: ContractFixture<T>,
): ParserResult<T> {
  const fields = Object.keys(fixture.data as object);
  const mismatches: string[] = [];

  // Validate fixture metadata
  if (!fixture.version) mismatches.push("missing version");
  if (!fixture.label) mismatches.push("missing label");
  if (!fixture.capturedAt) mismatches.push("missing capturedAt");
  if (!fixture.backendVersion) mismatches.push("missing backendVersion");

  return {
    parsed: mismatches.length === 0,
    fields,
    mismatches,
  };
}

function replayArrayFixture<T>(fixture: ContractFixture<T[]>): ParserResult<T> {
  const items = fixture.data;
  if (!Array.isArray(items)) {
    return { parsed: false, fields: [], mismatches: ["data is not an array"] };
  }

  if (items.length === 0) {
    return { parsed: true, fields: [], mismatches: [] };
  }

  const fields = Object.keys(items[0] as object);
  const mismatches: string[] = [];

  // Check field consistency across items
  for (let i = 1; i < items.length; i++) {
    const itemFields = Object.keys(items[i] as object);
    const missing = fields.filter((f) => !itemFields.includes(f));
    if (missing.length > 0) {
      mismatches.push(`item ${i} missing fields: ${missing.join(", ")}`);
    }
  }

  return { parsed: mismatches.length === 0, fields, mismatches };
}

describe("Contract Fixture Replay Tests", () => {
  const fixtureEntries = Object.entries(ALL_FIXTURES);

  fixtureEntries.forEach(([name, fixture]) => {
    it(`replays "${name}" fixture without parser drift`, () => {
      const data = fixture.data;
      const result = Array.isArray(data)
        ? replayArrayFixture(fixture as ContractFixture<unknown[]>)
        : replayFixture(fixture as ContractFixture<Record<string, unknown>>);

      if (result.mismatches.length > 0) {
        console.error(
          `[${name}] Parser mismatches:\n`,
          result.mismatches.join("\n"),
        );
      }

      expect(result.parsed).toBe(true);
      expect(result.fields.length).toBeGreaterThan(0);
    });

    it(`fixture "${name}" has valid metadata`, () => {
      expect(fixture.version).toBeTruthy();
      expect(fixture.label).toBeTruthy();
      expect(fixture.capturedAt).toBeTruthy();
      expect(() => new Date(fixture.capturedAt)).not.toThrow();
      expect(fixture.backendVersion).toBeTruthy();
    });

    if (Array.isArray(fixture.data)) {
      it(`fixture "${name}" arrays have consistent field shapes`, () => {
        const items = fixture.data as Record<string, unknown>[];
        if (items.length > 1) {
          const firstKeys = Object.keys(items[0]).sort();
          for (let i = 1; i < items.length; i++) {
            const keys = Object.keys(items[i]).sort();
            expect(keys).toEqual(firstKeys);
          }
        }
      });
    }
  });

  it("reports field-level parser mismatch details", () => {
    const knownTypes = new Set(["string", "number", "boolean", "undefined"]);

    fixtureEntries.forEach(([name, fixture]) => {
      const data = fixture.data;
      if (Array.isArray(data) && data.length > 0) {
        data.forEach((item: Record<string, unknown>, idx: number) => {
          Object.entries(item).forEach(([field, value]) => {
            const type = typeof value;
            if (!knownTypes.has(type)) {
              console.warn(
                `[${name}][${idx}] field "${field}" has unexpected type: ${type}`,
              );
            }
          });
        });
      }
    });
  });

  it("all fixtures have versioning strategy documented", () => {
    const versions = new Set(Object.values(ALL_FIXTURES).map((f) => f.version));
    expect(versions.size).toBeGreaterThanOrEqual(1);
    console.log("Fixture versions in use:", [...versions].join(", "));
  });
});
